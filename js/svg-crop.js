
/** 
 ** 
 ** class Box: a 2D bounding box 
 **  
 **  
 **/
class Box {
    constructor(left, right, top, bottom, valid = true) {
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
        this.valid = valid;
    }
        
};


Box.prototype.getMaximumSize = function () {
    var width = this.right - this.left;
    var height = this.bottom - this.top;
    if (width > height)
        return width;
    else
        return height;
}

Box.prototype.add = function(box) {
    if (box.valid) {
        if (box.left < this.left) this.left = box.left;
        if (box.top < this.top) this.top = box.top;
        if (box.right > this.right) this.right = box.right;
        if (box.bottom > this.bottom) this.bottom = box.bottom;
    }
}

Box.prototype.addPoint = function(point) {
    if (this.valid) {
        if (point[0] < this.left) this.left = point[0];
        if (point[1] < this.top) this.top = point[1];
        if (point[0] > this.right) this.right = point[0];
        if (point[1] > this.bottom) this.bottom = point[1];
    }
}

Box.prototype.center = function() {
    return [(this.left + this.right) / 2, (this.bottom + this.top) / 2];
}

Box.invalid = function() {
    return new Box(0, 0, 0, 0, false);
}

Box.fromPaths = function(paths) {
    if (paths.length == 0)
        return Box.invalid();
    
    var result = Box.fromPath(paths[0]);
    
    for(var i = 1; i < paths.length; ++i) {
        result.add(Box.fromPath(paths[i]));
    }
    return result;

};


Box.fromShape = function(shape) {
    var result = Box.fromPath(shape.polyline);
    
    if (shape.holes.length > 0) {
        result.add(Box.fromPaths(shape.holes));
    }
    return result;

};

Box.fromShapes = function(shapes) {
    if (shapes.length == 0)
        return Box.invalid();
    
    
    var result = Box.fromShape(shapes[0]);
    
    for(var i = 1; i < shapes.length; ++i) {
        result.add(Box.fromShape(shapes[i]));
    }
    return result;
}

Box.fromPath = function(path) {
    if (path.length == 0)
        return Box.invalid();
    var result = new Box(path[0][0], path[0][0], path[0][1], path[0][1]);
    
    for(var i = 1; i != path.length; ++i) {
        result.addPoint(path[i]);
    }
    return result;
};


Box.fromXY = function(vertices) {
    if (vertices.length == 0)
        return Box.invalid();
    var result = new Box(vertices[0].x, vertices[0].x, vertices[0].y, vertices[0].y);
    
    for(var i = 1; i != vertices.length; ++i) {
        result.addPoint([vertices[i].x, vertices[i].y]);
    }
    return result;

}


function inside(point, vs) {
    // function from  https://github.com/substack/point-in-polygon (MIT license)
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point[0], y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};


function clockwise(path) {
    if (path.length <= 2) {
            return false;
    }
    
    if ((path[0][0] != path[path.length - 1][0]) ||
        (path[0][1] != path[path.length - 1][1])) {
        console.log("ERROR: one path is not defined as a loop", path);
    }
    var sum = 0;
    for(var i = 1; i != path.length; ++i) {
        var p1 = path[i - 1];
        var p2 = path[i];
        sum += (p2[0] - p1[0]) * (p2[1] + p1[1]);
    }
    return sum >= 0;
    
}


function addPointIfMissing(path, point, precision) {
    var epsilon = 0.1 ** (precision + 4);
    if (path.length <= 1)
        return path;
    
    for(var i = 1; i != path.length; ++i) {
        var p1 = path[i - 1];
        var p2 = path[i];
        var dist = distanceSqrdPointSegment(point, p1, p2, epsilon);
        if ((dist >= 0) && (dist <= epsilon)) {
            var d1 = distanceSqrd(point, p1);
            if (d1 > epsilon) {
                var d2 = distanceSqrd(point, p2);
                if (d2 > epsilon) {
                    path.splice(i, 0, point);
                    return path;
                }
            }
        }
    }
    
    return path;
    
}

function truncator(x, precision) {    
    var npow = Math.pow(10, precision);
    return Math.round(x * npow) / npow;
}


/*
 * A SVG shape is defined by:
 *  * a non closed polyline
 *  * a contour, and a (possibly empty) list of inner polygons (=holes)
 *  * a fill color
 * */
class SVGShape2D {
    
    constructor(polyline, fillColor, holes = []) {
        this.polyline = polyline;
        this.holes = holes;
        this.color = fillColor;
    }
    
    toList() {
        return [this.polyline].concat(this.holes);
    }
    
    isPolygon() {
        return ((this.polyline[0][0] == this.polyline[this.polyline - 1][0]) &&
                (this.polyline[0][1] == this.polyline[this.polyline - 1][1]));
    }
    
    adjustPathsToPrecision(precision) {
        if (precision >= 0) {
            for(var i = 0; i < this.holes.length; ++i) {
                for(var j = 0; j < this.holes[i].length; ++j) {
                    this.holes[i][j] = [truncator(this.holes[i][j][0], precision), 
                                            truncator(this.holes[i][j][1], precision)];
                }
            }
            
            for(var j = 0; j < this.polyline.length; ++j) {
                this.polyline[j] = [truncator(this.polyline[j][0], precision), 
                                    truncator(this.polyline[j][1], precision)];
            }
        }
    }
    
    removeConsecutiveDoubles() {
        for(var i = 0; i < this.holes.length; ++i) {
            this.holes[i] = this.holes[i].filter(function(item, pos, arr){  return pos === 0 || 
                                                                                    item[0] !== arr[pos - 1][0] ||
                                                                                    item[1] !== arr[pos - 1][1]; });
        }
        

        this.polyline = this.polyline.filter(function(item, pos, arr){  return pos === 0 || 
                                                                                      item[0] !== arr[pos - 1][0] ||
                                                                                      item[1] !== arr[pos - 1][1]; });
    }

    rescaleAndCenter(ratio, center) {
       
        for(var k = 0; k < this.polyline.length; ++k) {
            this.polyline[k] = [(this.polyline[k][0] - center[0]) * ratio, 
                                (this.polyline[k][1] - center[1]) * ratio];
        }
        
        // rescale and center 
        for(var j = 0; j < this.holes.length; ++j) {
            for(var k = 0; k < this.holes[j].length; ++k) {
                this.holes[j][k] = [(this.holes[j][k][0] - center[0]) * ratio, 
                                        (this.holes[j][k][1] - center[1]) * ratio];
            }
        }
    }
    
    // if one point of the other shape is in an edge of the current shape, add it
    addMissingPointsFromShape(shape, precision) {
        
        // for each path of this shape
        this.addMissingPointsFromPath(shape.polyline, precision);
        for(var h of shape.holes) {
            this.addMissingPointsFromPath(h, precision);
        }
    
    }
    
    addMissingPointsFromPath(path, precision) {
        for(var p of path) {
            this.polyline = addPointIfMissing(this.polyline, p, precision);
            for(var x = 0; x != this.holes.length; ++x)
                this.holes[x] = addPointIfMissing(this.holes[x], p, precision);
        }        
    }

    union(shapes) {
        var newShapes = martinez.union(this.toList(), SVGShape2D.shapesToList(shapes));
        return TreeNode.splitIntoShapes(newShapes, "union");
    }
    
    diff(shapes) {
        var newShapes = martinez.diff(this.toList(), SVGShape2D.shapesToList(shapes));
        return TreeNode.splitIntoShapes(newShapes, this.color);
    }
    
    intersection(shapes) {
        var newShapes = martinez.intersection(this.toList(), SVGShape2D.shapesToList(shapes));
        return TreeNode.splitIntoShapes(newShapes, this.color);
    }
}

SVGShape2D.shapesToList = function(shapes) {
    var result = [];
    for(var s of shapes) {
        result.push(s.toList());
    }
    return result;
}


/**
 * class TreeNode is a hierarchical structure to detect
 * inclusions between polygons.
 * It is used to distinguish between contours and holes 
 * in 2D drawings.
 * 
 * */
class TreeNode {
        constructor(polygon, color, children = []) {
            this.polygon = polygon;
            this.children = children;
            this.color = color;
        }

        addPolygon(polygon) {
            if (polygon.length == 0) {
                return;
            }
            if (this.children.length == 0) {
                this.children.push(new TreeNode(polygon, this.color, []));
            }
            else {
                var found = false;
                for(var i = 0; i < this.children.length; ++i) {
                    var point = polygon[0];
                    // if the given polygon is contained in one
                    // child, we add the polygon to this child
                    if (inside(point, this.children[i].polygon)) {
                        this.children[i].addPolygon(polygon);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var insideChildren = this.children.filter(v => inside(v.polygon[0], polygon));
                    if (insideChildren.length > 0) {
                        this.children = this.children.filter(v => !inside(v.polygon[0], polygon));
                        this.children.push(new TreeNode(polygon, this.color, insideChildren)); 
                    }
                    else {
                        // the polygon is not contained in any child
                        // thus it is a brother
                        this.children.push(new TreeNode(polygon, this.color, []));
                    }
                    
                }
            }
        }
        
        flatten() {
            var result = [];
            
            for(var i = 0; i < this.children.length; ++i) {
                    var holes = [];
                    for(var j = 0; j < this.children[i].children.length; ++j) {
                        if (!clockwise(this.children[i].children[j].polygon)) {
                            this.children[i].children[j].polygon.reverse();
                        }
                        holes.push(this.children[i].children[j].polygon);
                    }
                    if (clockwise(this.children[i].polygon)) {
                        this.children[i].polygon.reverse();
                    }
                    result.push(new SVGShape2D(this.children[i].polygon, this.color, holes));
                    for(var j = 0; j < this.children[i].children.length; ++j) {
                        result = result.concat(this.children[i].children[j].flatten());
                    }
            }
            
            
            return result;
        }
};

// given a list of paths (or a list of list of paths), it split it into a list of shapes.
// following geojson specifications: https://geojson.org/geojson-spec.html#id7
// A polygon is defined by a list of rings, the first one being the contours,
// and the following the holes
TreeNode.splitIntoShapes = function(paths, color) {
        
        if (paths.length == 0)
            return paths;
        
        var tree = TreeNode.root(color);
        
        if (typeof paths[0][0][0] === 'number') {
            for(var i = 0; i < paths.length; ++i) {
                    tree.addPolygon(paths[i]);
            }
        }
        else {
            for(var i = 0; i < paths.length; ++i) {
                for(var j = 0; j < paths[i].length; ++j) {
                    tree.addPolygon(paths[i][j]);
                }
            }
            
        }
        return tree.flatten();
    }

TreeNode.root = function(color = "") {
        return new TreeNode(null, color, []);
}


function getFillColor(elem) {
    var regex = /([\w-]*)\s*:\s*([^;]*)/g;
    var match, properties={};
    while(match = regex.exec($(elem).attr("style"))) properties[match[1].trim()] = match[2].trim();
    return "fill" in properties ? properties["fill"] : "#000000";
}

function getIDFromURL(url) {
    var expr = new RegExp("[uU][rR][lL][ ]*\\(#[ ]*[\"\']?([A-Za-z][A-Za-z0-9\-\:\.]*)[\"\']?[ ]*\\)");
    var match = expr.exec(url);
    if (match.length == 2)
        return match[1];
    else
        return null;
}

/* 
 * A SVG group is defined by:
 *  * a SVGshape2D or a list of SVGgroup
 *  * a clip-path defined as an SVG group
 *  * a mask defined as an SVG group
 *  
 */
class SVGGroup2D {
    constructor(elem, root = null, forceClip = false) {
        if (root == null)
            root = elem;
        
        this.shape = null;
        this.content = null;
        this.clipPath = null;
        this.mask = null;
        
        if (elem && elem.children && elem.children.length && (forceClip || !(elem instanceof SVGClipPathElement) && !(elem instanceof SVGMaskElement))) {
            this.content = [];
            for(var e = 0; e != elem.children.length; ++e) {
                var child = new SVGGroup2D(elem.children[e], root);
                if (!child.empty())
                    this.content.push(child);
            }
        }
        else if (elem instanceof SVGPathElement) {
            // read SVG path
            var svgPath = elem.getAttribute("d");
            
            var svgColor = getFillColor(elem);
            
            // Turn SVG path into a three.js shape (that can be composed of a list of shapes)
            var path = d3.transformSVGPath(svgPath);
                
            // extract shapes associated to the svg path,
            var newShapes = path.toShapes(this.svgWindingIsCW);

            // discretize them, and convert them to a basic list format
            newShapes = SVGGroup2D.convertToList(newShapes, 50);

            // possibly split the original path in multiple shapes
            var shapes = TreeNode.splitIntoShapes(newShapes, svgColor);
            if (shapes.length == 0) {
                // empty shape
                return;
            }
            else if (shapes.length == 1) {
                this.shape = shapes[0];
            }
            else {
                this.content = [];
                for(var s = 0; s != shapes.length; ++s) {
                    this.content.push(shapes[s]);
                }
            }
        }
        else {
            console.log("WARNING: svg element not handled - " + elem);
        }
        
        if (elem.hasAttribute("clip-path")) {
            var id = getIDFromURL(elem.getAttribute("clip-path"));
            if (id) {
                var newElem = root.getElementById(id);
                this.clipPath = new SVGGroup2D(newElem, root, true);
            }
            
        }
        if (elem.hasAttribute("mask")) {
            var id = getIDFromURL(elem.getAttribute("mask"));
            if (id) {
                var newElem = root.getElementById(id);
                this.mask = new SVGGroup2D(newElem, root, true);
            }
            
        }
    }
    
    empty() {
        return this.content == null && this.shape == null;
    }
    
    
    applyClipping(clipPath) {
        if (this.shape) {
            // apply intersection
            var res = this.shape.intersection(clipPath);
            if (res.length > 1) {
                // if multiple elements, create a group
                this.content = res;
            }
            else if (res.length == 1) {
                // otherwise, the shape is the first one
                this.shape = res[0];
            }
            else
                // a clipping can remove all the parts of a shape
                this.shape = null;
        }
        if (this.content) {
            for(var c of this.content) {
                c = c.applyClipping(clipPath);
            }
        }
    }
    
    applyClippings() {
        if (this.content != null) {
            // apply first the clippings inside the shape
            for(var c of this.content) {
                c.applyClippings();
            }
        }
        
        // if the current node has a clipping path, apply it 
        if (this.clipPath) {
            // get a flat description of clipPath
            var clipFlat = this.clipPath.getShapesList();
            // apply this clipping path
            this.applyClipping(clipFlat);
            // remove it from the data structure
            this.clipPath = null;
        }
        
    }

    flatten() {
        
        // first apply clippings
        this.applyClippings();
        
        // TODO: handle masks
        
        // then return shape list
        return this.getShapesList();
    }
     
    getShapesList() {
        var result = [];
        
        if (this.shape != null) {
            result.push(this.shape);
        }
        else {
            if (this.content != null) {
                for(var v = 0; v != this.content.length; ++v) {
                    var elems = this.content[v].getShapesList();
                    if (elems.length != 0)
                        result = result.concat(elems);
                }
            }
        }
        
        return result;
    }
    
    
}

SVGGroup2D.convertToList = function(shapes, steps) {
    var result = [];
    
    for (var j = 0; j < shapes.length; j++) {
        var pts = shapes[j].extractPoints(steps);
        var paths = [pts.shape].concat(pts.holes);
                    
        for(var a = 0; a != paths.length; ++a) {
            for(var b = 0; b != paths[a].length; ++b) {
                if (this.precision >= 0)
                    paths[a][b] = [parseFloat(paths[a][b].x.toFixed(this.precision)), 
                                    parseFloat(paths[a][b].y.toFixed(this.precision))];
                else
                    paths[a][b] = [parseFloat(paths[a][b].x), parseFloat(paths[a][b].y)];
            }
        }
        result.push(paths);
    }
    return result;
}


class SVGCrop {

    
    constructor(svgID, options, viewBox) {
        this.svgNode = document.getElementById(svgID);
        this.options = options;
        this.silhouette = null;
        this.svgWindingIsCW = options.svgWindingIsCW;
        this.viewBox = viewBox;
        this.precision = this.options.discretization ? this.options.precision : -1;
        this.shapes = null;
        this.svgStructure = null;
    }


    
    addMissingPoints() {
        
        for(var x = 0; x != this.shapes.length; ++x) {
            for(var y = 0; y != this.shapes.length; ++y) {
                if (x != y) {
                    this.shapes[x].addMissingPointsFromShape(this.shapes[y], this.precision);
                }
            }
        }
    
    }
          

    
    getBoundsOfShapes() {
        return Box.fromShapes(this.shapes);
    }
    
    
    adjustToPrecision() {
        if (this.shapes != null) {
            for(var s of this.shapes) {
                s.adjustPathsToPrecision(this.precision);
                s.removeConsecutiveDoubles();
            }
        }
        if (this.silhouette != null) {
            for(var s of this.silhouette) {
                s.adjustPathsToPrecision(this.precision);
                s.removeConsecutiveDoubles();
            }
        }
    }
          
    // center and rescale to match the desired width
    rescaleAndCenter(width) {
        var bbox = this.getBoundsOfShapes();
        var ratio = width / (bbox.right - bbox.left);
        var center = bbox.center();
        // rescale and center paths
        
        for(var s of this.shapes) {
            s.rescaleAndCenter(ratio, center);
        }

        for(var s of this.silhouette) {
            s.rescaleAndCenter(ratio, center);
        }
    }
          
    process() {
        this.svgStructure = new SVGGroup2D(this.svgNode);
        // produce a list of shapes (hierarchical structure is only required
        // for mask and clip)
        this.shapes = this.svgStructure.flatten();
        
        this.precision *= this.getScale();
        
        if (this.shapes.length > 0) { 
 
            this.adjustToPrecision();
            
            if (this.options.wantBasePlate != null)
                this.addBasePlateInternal();
            
            this.clipShapesUsingVisibility();
                    
            // center and scale the shapes
            this.rescaleAndCenter(options.objectWidth - (options.baseBuffer * 2));

            // add possible missing vertices along the paths
            // when two shapes are sharing a common edge
            this.addMissingPoints();
            
            // adjust to precision before any other step
            this.adjustToPrecision();
        }

    }




    getScale() {
        var bbox;
        if (this.options.ignoreDocumentMargins) {
            bbox = this.getBoundsOfShapes();
        }
        else {
            bbox = new Box(this.viewBox[0], this.viewBox[2], 
                           this.viewBox[1], this.viewBox[3]);
        }
        
        return this.options.objectWidth / (bbox.right - bbox.left) ;
        
    }
    
    addBasePlateInternal() {
        // compute the effective bounding box, defined or by document margin, or by shapes
        var bbox;
        var plate;
        
        if (this.options.ignoreDocumentMargins) {
            bbox = this.getBoundsOfShapes();
        }
        else {
            bbox = new Box(this.viewBox[0], this.viewBox[2], 
                           this.viewBox[1], this.viewBox[3]);
        }
        
        // add offset if required
        if (this.options.baseBuffer > 0) {
            var buffer = this.options.baseBuffer / this.options.objectWidth * (bbox.right - bbox.left);
            bbox.left -= buffer;
            bbox.top -= buffer;
            bbox.right += buffer;
            bbox.bottom += buffer;
        }
        
        // create the final shape
        if(this.options.basePlateShape === "Rectangular" || 
            this.options.basePlateShape === "Squared") {
            // first turn it into a square if required
            if (this.options.basePlateShape==="Squared") {
                var width = bbox.right - bbox.left;
                var height = bbox.bottom - bbox.top;
                var middle = [(bbox.left + bbox.right) / 2, (bbox.bottom + bbox.top) / 2];
                var halfSize = (width > height ? width : height) / 2;
                bbox.left = middle[0] - halfSize;
                bbox.right = middle[0] + halfSize;
                bbox.top = middle[1] - halfSize;
                bbox.bottom = middle[1] + halfSize;
            }
            // then create the path
            plate = [[bbox.left, bbox.bottom],
                    [bbox.right, bbox.bottom],
                    [bbox.right, bbox.top],                    
                    [bbox.left, bbox.top]
                    ];
            
        }
        // Otherwise a circle
        else {
            var middle = bbox.center();
            var corner = [bbox.left, bbox.top];
            var radius = Math.sqrt(distanceSqrd(middle, corner));
            plate = [];
            var nbPoints = 128;
            for(var i = 0; i != nbPoints; i++) {
                plate.push([middle[0] + radius * Math.cos(i / nbPoints * 6.283185307179586), 
                            middle[1] + radius * Math.sin(i / nbPoints * 6.283185307179586)]);
            }
        }
        // close the shape
        plate.push(plate[0]);
        
        this.shapes.unshift(new SVGShape2D(plate, "base"));
        
        // add the depth of the plate
        options.typeDepths["base"] = 0.0;
    }
    
    clipShapesUsingVisibility() {
        var shapes = [];
        this.silhouette = [];
                
        
        if (this.shapes.length > 0) { 
            // use inverse order to crop shapes according to their visibility
            for (var i = this.shapes.length - 1; i >= 0; i--) {
                var curShape = this.shapes[i];
                var newShapes;
                
                if (this.silhouette.length == 0) {
                        this.silhouette = [curShape];
                        newShapes = this.silhouette;
                }
                else {
                    // we have to add the new shapes to the structure
                    newShapes = curShape.diff(this.silhouette);
                    
                    this.silhouette = curShape.union(this.silhouette);
                }
                
                shapes = newShapes.concat(shapes);
 
                
            }
            
        }
        
        this.shapes = shapes;
     
    }

    
    getShapes() { 
        if (this.shapes == null)
            this.process();
        return this.shapes; 
    }
    
    getNbShapes() { 
        if (this.shapes == null)
            this.process();
        return this.shapes.length; 
        
    }
    
    getColors() {
        if (this.shapes == null)
            this.process();

        var result = [];
        for(var s of this.shapes) {
            result.push(s.color);
        }
        return result;
    }
    
    
    getPalette() {
        if (this.svgColors == null)
            this.process();
        var result = [];
        for(var s of this.shapes) {
            if (s.color != "base")
                result.push(s.color);
        }
        return result;
    }

    
    getSilhouette() { 
        if (this.silhouette == null)
            this.process();
        return this.silhouette;
    }

};
