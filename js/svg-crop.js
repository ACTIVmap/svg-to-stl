
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


Box.fromShapes = function(shapes) {
    if (shapes.length == 0)
        return Box.invalid();
    
    var result = Box.fromPaths(shapes[0]);
    
    for(var i = 1; i < shapes.length; ++i) {
        result.add(Box.fromPaths(shapes[i]));
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

Box.fromPath = function(path) {
    if (path.length == 0)
        return Box.invalid();
    var result = new Box(path[0][0], path[0][0], path[0][1], path[0][1]);
    
    for(var i = 1; i != path.length; ++i) {
        result.addPoint(path[i]);
    }
    return result;
};



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


/**
 * class TreeNode is a hierarchical structure to detect
 * inclusions between polygons.
 * It is used to distinguish between contours and holes 
 * in 2D drawings.
 * 
 * */
class TreeNode {
        constructor(polygon, children = []) {
            this.polygon = polygon;
            this.children = children;
        }

        addPolygon(polygon) {
            if (polygon.length == 0) {
                return;
            }
            if (this.children.length == 0) {
                this.children.push(new TreeNode(polygon, []));
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
                        this.children.push(new TreeNode(polygon, insideChildren)); 
                    }
                    else {
                        // the polygon is not contained in any child
                        // thus it is a brother
                        this.children.push(new TreeNode(polygon, []));
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
                    result.push([this.children[i].polygon].concat(holes));
                    
                    for(var j = 0; j < this.children[i].children.length; ++j) {
                        result = result.concat(this.children[i].children[j].flatten());
                    }
            }
            
            
            return result;
        }
};

// given a list of paths (or a list of list of paths), it split it into a list of polygons.
// following geojson specifications: https://geojson.org/geojson-spec.html#id7
// A polygon is defined by a list of rings, the first one being the contours,
// and the following the holes
TreeNode.splitIntoShapes = function(paths) {
        
        if (paths.length == 0)
            return paths;
        
        var tree = TreeNode.root();
        
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

TreeNode.root = function() {
        return new TreeNode(null, []);
}

class SVGCrop {

    
    constructor(svgID, options, viewBox) {
        this.svgNode = document.getElementById('uploadedSVG');
        this.options = options;
        this.paths = null;
        this.colors = null;
        this.silhouette = null;
        this.svgPaths = null;
        this.svgColors = null;
        this.svgWindingIsCW = options.svgWindingIsCW;
        this.viewBox = viewBox;
        this.precision = this.options.discretization ? this.options.precision * this.getScale() : -1;
        
    }

    loadSVG() {
        // TODO: add support of clip-path and masks
        if (this.svgPaths == null)
            this.svgPaths = $("path", this.svgNode).map(function(){return $(this).attr("d");}).get();
        
        if (this.svgColors == null)
            this.svgColors = $("path", this.svgNode).map(
                function(){ 
                        var regex = /([\w-]*)\s*:\s*([^;]*)/g;
                        var match, properties={};
                        while(match=regex.exec($(this).attr("style"))) properties[match[1].trim()] = match[2].trim();
                        return "fill" in properties ? properties["fill"] : "#000000";
                    }
            ).get();
    }
    
    addPointIfMissing(path, point) {
        var epsilon = 0.1 ** (this.precision + 4);
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
    
    
    addMissingPoints() {
        // for each path of each shape
        for(var i = 0; i != this.paths.length; ++i) {
            for(var j = 0; j != this.paths[i].length; ++j) {
                // add possible vertices from any other shape
                for(var ii = 0; ii != this.paths.length; ++ii) {
                    if (ii != i) {
                        for(var jj = 0; jj != this.paths[ii].length; ++jj) {
                            for(var kk = 0; kk != this.paths[ii][jj].length; ++kk) {
                                this.paths[i][j] = this.addPointIfMissing(this.paths[i][j], this.paths[ii][jj][kk]);
                            }
                        }
                    }
                }
            }
        }
    }
          
    adjustPathsToPrecision(paths) {
        if (this.precision >= 0) {
            for(var i = 0; i < paths.length; ++i) {
                for(var j = 0; j < paths[i].length; ++j) {
                    for(var k = 0; k < paths[i][j].length; ++k) {
                        paths[i][j][k] = [truncator(paths[i][j][k][0], this.precision), 
                                               truncator(paths[i][j][k][1], this.precision)];
                    }
                }
            }
        }
    }
    
    removeConsecutiveDoubles(paths) {
        for(var i = 0; i < paths.length; ++i) {
            for(var j = 0; j < paths[i].length; ++j) {
                paths[i][j] = paths[i][j].filter(function(item, pos, arr){  return pos === 0 || 
                                                                                item[0] !== arr[pos - 1][0] ||
                                                                                item[1] !== arr[pos - 1][1]; });
            }
        }
        
    }
    
    adjustToPrecision() {
        if (this.paths != null) {
                this.adjustPathsToPrecision(this.paths);
                this.removeConsecutiveDoubles(this.paths);
        }
        if (this.silhouette != null) {
                this.adjustPathsToPrecision(this.silhouette);
                this.removeConsecutiveDoubles(this.silhouette);
        }
    }
          
    // center and rescale to match the desired width
    rescaleAndCenter(width) {
        var bbox = this.getBoundsOfShapes();
        var ratio = width / (bbox.right - bbox.left);
        var center = bbox.center();
        // rescale and center paths
        for(var i = 0; i < this.paths.length; ++i) {
            for(var j = 0; j < this.paths[i].length; ++j) {
                for(var k = 0; k < this.paths[i][j].length; ++k) {
                    this.paths[i][j][k] = [(this.paths[i][j][k][0] - center[0]) * ratio, 
                                           (this.paths[i][j][k][1] - center[1]) * ratio];
                }
            }
        }
        // rescale and center silhouette
       for(var i = 0; i < this.silhouette.length; ++i) {
            for(var j = 0; j < this.silhouette[i].length; ++j) {
                for(var k = 0; k < this.silhouette[i][j].length; ++k) {
                    this.silhouette[i][j][k] = [(this.silhouette[i][j][k][0] - center[0]) * ratio, 
                                            (this.silhouette[i][j][k][1] - center[1]) * ratio];
                }
            }
        }

                
    }
          
    process() {
        if (this.svgPaths == null) {
            this.loadSVG();
        }
        
        this.paths = [];
        this.colors = [];
        if (this.svgPaths.length > 0) { 
            for (var i = 0; i < this.svgPaths.length; i++) {
                // Turn each SVG path into a three.js shape (that can be composed of a list of shapes)
                var path = d3.transformSVGPath(this.svgPaths[i]);
                
                // extract shapes associated to the svg path,
                // discretize them, and convert them to a basic list format
                var shapes = path.toShapes(this.svgWindingIsCW);
                // TODO: remove all this old things with steps, discretization, etc.
                var nbAdded = this.addNewShapes(shapes, 50);
                for(var j = 0; j != nbAdded; ++j) {
                    this.colors.push(this.svgColors[i]);
                }
            }
        
            if (this.options.wantBasePlate != null)
                this.addBasePlateInternal();
            

            this.adjustToPrecision();
            
            this.applyMasksAndClips();
        
            this.clipPathsUsingVisibility();
                    
            // center and scale the shapes
            this.rescaleAndCenter(options.objectWidth - (options.baseBuffer * 2));

            // add possible missing vertices along the paths
            // when two shapes are sharing a common edge
            this.addMissingPoints();
            
            // adjust to precision before any other step
            this.adjustToPrecision();
        }

    }
    
    // at this step, the orientation of the shape
    // and the structure (contour + holes) are not verified
    addNewShapes(shapes, steps) {
        var nb = 0;
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
            this.paths.push(paths);
            ++nb;
        }
        return nb;
    }
    
    applyMasksAndClips() {
        // TODO
    }

    getBoundsOfShapes() {
        return Box.fromShapes(this.paths);
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
        
        this.paths.unshift([plate]);
        
        // add the depth of the plate
        this.colors.unshift("base");
        options.typeDepths["base"] = 0.0;
    }
    
    clipPathsUsingVisibility() {
        var shapes = [];
        var colorShapes = [];
        this.silhouette = [];
                
        
        if (this.paths.length > 0) { 
            // use inverse order to crop shapes according to their visibility
            for (var i = this.paths.length - 1; i >= 0; i--) {
                var curPaths = this.paths[i];
                var newShapes;
                                
                if (this.silhouette.length == 0) {
                        this.silhouette = TreeNode.splitIntoShapes(curPaths);
                        newShapes = this.silhouette;
                }
                else {
                    // we have to add the new shapes to the structure
                    var sp = TreeNode.splitIntoShapes(curPaths);
                    newShapes = martinez.diff(sp, this.silhouette);
                    
                    // the new this.silhouette is the union
                    this.silhouette = martinez.union([curPaths], this.silhouette);

                    this.silhouette = TreeNode.splitIntoShapes(this.silhouette);
                }

                // add it to the final data structure
                var split = TreeNode.splitIntoShapes(newShapes);
                for(var j = 0; j < split.length; ++j) {
                    shapes.unshift(split[j]);
                    colorShapes.unshift(this.colors[i]);
                }
 
                
            }
            
        }
        
        this.paths = shapes;
        this.colors = colorShapes;
     
    }

    
    getPaths() { 
        if (this.paths == null)
            this.process();
        return this.paths; 
    }
    
    getNbPaths() { 
        if (this.paths == null)
            this.process();
        return this.paths.length; 
        
    }
    
    
    getPalette() {
        if (this.svgColors == null)
            this.loadSVG();
        return this.svgColors;
    }
    getColors() { 
        if (this.colors == null)
            this.process();
        return this.colors; 
    }
    
    getSilhouette() { 
        if (this.silhouette == null)
            this.process();
        return this.silhouette;
    }

};
