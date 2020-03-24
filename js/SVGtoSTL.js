// Removes all children from a three.js group
function clearGroup(group) {
    for (var i = group.children.length; i >= 0; i--) {
        group.remove(group.children[i]);
    }
}

// Takes an SVG string, and returns a scene to render as a 3D STL
function renderObject(paths, viewBox, svgColors, scene, group, camera, options) {
    console.log("Rendering 3D object...");
    // Solid Color
    options.color = new THREE.Color( options.objectColor ); 
    options.material = (options.wantInvertedType) ?
        new THREE.MeshLambertMaterial({
          color: options.color,
          emissive: options.color,
        }) :
        new THREE.MeshLambertMaterial({
          color: options.color,
          emissive: options.color,
          side:THREE.DoubleSide});

    // Create an extrusion from the SVG path shapes
    var finalObj = getExtrudedSvgObject(paths, viewBox, svgColors, options);


    // Add the merged geometry to the scene
    group.add(finalObj);
    
    // change zoom wrt the size of the mesh
    camera.position.set(0, - options.objectWidth, options.objectWidth);

    // Show the wireframe?
    if(options.wantWireFrame) {
        var wireframe = new THREE.WireframeGeometry(finalObj.geometry);
        var lines = new THREE.LineSegments( wireframe );
        lines.material.depthTest = false;
        lines.material.opacity = 0.25;
        lines.material.transparent = true;
        group.add(lines);
    }
    // Show normals?
    if(options.wantNormals) {
        var normals = new THREE.FaceNormalsHelper(finalObj, 2, 0x000000, 1);
        group.add(normals);
    }
    // Show hard edges?
    if(options.wantEdges) {
        var edges = new THREE.EdgesGeometry( finalObj.geometry);
        var lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial( { color: 0xffffff } ));
        group.add(lines);
    }
    
    /// add backgroup a background grid
    var helper = new THREE.GridHelper( options.objectWidth * 1.3, 10 );
    helper.rotation.x = Math.PI / 2;
    group.add( helper );
    
    finalObj.geometry.computeBoundingBox();
    
    return { vertices : finalObj.geometry.vertices.length, faces : finalObj.geometry.faces.length,
             bbox : finalObj.geometry.boundingBox };
};


// Creates a three.js Mesh object out of SVG paths
function getExtrudedSvgObject(paths, viewBox, svgColors, options) {
    
    
    // get the depths following the colors of the svg mesh
    var depths = [];
    for(var i = 0; i < svgColors.length; ++i) {
        depths.push(options.typeDepths[svgColors[i]]);
    }

    // load svg paths into a scene (discretize the curves, to only manipulate polygons)
    var scene = new SVG3DScene(paths, depths, 50, options.discretization ? options.precision : -1,
                               options.svgWindingIsCW);
    
    // if we wanted a base plate, let's add a supplementary path
    if(options.wantBasePlate) {
        scene.addBasePlate(viewBox, options.ignoreDocumentMargins, options.baseBuffer, options.objectWidth, options.basePlateShape);
    }

    // center and scale the shapes
    scene.rescaleAndCenter(options.objectWidth - (options.baseBuffer * 2));
        
    // stick similar curves if required
    if (options.mergeDistance > 0) {
        scene.stickSimilarCurves(options.mergeDistance);
    }
    
    // finally, generate 3D shapes with an extrude process
    return scene.create3DShape(options.baseDepth, options.wantInvertedType, options.material);


};


/** 
 ** 
 ** Utils
 **  
 **  
 **/

function truncator(x, precision) {    
    var npow = Math.pow(10, precision);
    return Math.round(x * npow) / npow;
}

function distanceSqrd(a, b) {
    var c = a[0] - b[0];
    var d = a[1] - b[1];
    return c * c + d * d
};
    

// return distance between a point C and a segment [A, B]
// or -1 if the nearest point along (A, B) line is ouside of the segment [A, B]
function distanceSqrdPointSegment(C, A, B, epsilon) {
    // cf http://www.faqs.org/faqs/graphics/algorithms-faq/
    // Subject 1.02: How do I find the distance from a point to a line?
    var L2 = distanceSqrd(A, B);
    if (L2 <= epsilon)
        return -1;
    var r = ((C[0] - A[0]) * (B[0] - A[0]) + (C[1] - A[1]) * (B[1] - A[1])) / L2;

    if ((r < 0) || (r > 1))
        return -1;
    else {
        var Px = A[0] + r * (B[0] - A[0]);
        var Py = A[1] + r * (B[1] - A[1]);
        
        return distanceSqrd(C, [Px, Py]);
    }
}

// given a list of points, it creates the corresponding THREE.js structure.
function toTHREE(points) {
    var cpoints = [];
    for(var p = 0; p != points.length; p++) {
        cpoints.push(new THREE.Vector2(points[p][0], points[p][1]));
    }
    return cpoints;
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


Box.fromPath = function(path) {
    if (path.length == 0)
        return Box.invalid();
    var result = new Box(path[0][0], path[0][1], path[0][0], path[0][1]);
    
    for(var i = 1; i != path.length; ++i) {
        result.addPoint(path[i]);
    }
    return result;
};




/** 
 ** 
 ** class SVG3DScene: a class to convert SVG paths to 3D shape
 **  
 **  
 **/
class SVG3DScene {
    
    // discretize paths and convert it to the desired format
    constructor(paths, depths, steps, precision, svgWindingIsCW) {
        this.silhouetteShapes = null;
        this.precision = precision;
        this.paths = [];
        this.depths = [];
        if (paths.length > 0) { 
            for (var i = 0; i < paths.length; i++) {
                // Turn each SVG path into a three.js shape (that can be composed of a list of shapes)
                var path = d3.transformSVGPath(paths[i]);
                
                // extract shapes associated to the svg path,
                // discretize them, and convert them to a basic list format
                var shapes = path.toShapes(svgWindingIsCW);
                var nbAdded = this.addNewShapes(shapes, steps);
                for(var j = 0; j != nbAdded; ++j) {
                    this.depths.push(depths[i]);
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
                        paths[a][b] = [paths[a][b].x.toFixed(this.precision), paths[a][b].y.toFixed(this.precision)];
                    else
                        paths[a][b] = [paths[a][b].x, paths[a][b].y];
               }
            }
            this.paths.push(paths);
            ++nb;
        }
        return nb;
    }
    
    getBoundsOfShapes() {
        return Box.fromShapes(this.paths);
    }
    


    addBasePlate(viewBox, ignoreDocumentMargins, baseBuffer, objectWidth, basePlateShape) {
        // compute the effective bounding box, defined or by document margin, or by shapes
        var bbox;
        var plate;
        
        if (ignoreDocumentMargins) {
            bbox = this.getBoundsOfShapes();
        }
        else {
            bbox = new Box(viewBox[0], viewBox[2], viewBox[1], viewBox[3]);
        }
        
        // add offset if required
        if (baseBuffer > 0) {
            var buffer = baseBuffer / objectWidth * (bbox.right - bbox.left);
            bbox.left -= buffer;
            bbox.top -= buffer;
            bbox.right += buffer;
            bbox.bottom += buffer;
        }
        
        // create the final shape
        if(basePlateShape==="Rectangular" || basePlateShape==="Squared") {
            // first turn it into a square if required
            if (basePlateShape==="Squared") {
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
            var radius = distanceSqrd(middle, corner);
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
        this.depths.unshift(0.0);
    }

    // center and rescale to match the desired width
    rescaleAndCenter(width) {
        var bbox = this.getBoundsOfShapes();
        var ratio = width / (bbox.right - bbox.left);
        var center = bbox.center();
        
        for(var i = 0; i < this.paths.length; ++i) {
            for(var j = 0; j < this.paths[i].length; ++j) {
                for(var k = 0; k < this.paths[i][j].length; ++k) {
                    this.paths[i][j][k] = [(this.paths[i][j][k][0] - center[0]) * ratio, 
                                           (this.paths[i][j][k][1] - center[1]) * ratio];
                }
            }
        }
        
        this.adjustToPrecision();
        
    }

    getSimilarPointsToFirst(point, ii, jj, kk, distance) {
        var sim = { middle: point, pts: [[ii, jj, kk]] };
        for(var i = ii; i != this.paths.length; ++i) {
            for(var j = (i == ii) ? jj : 0; j != this.paths[i].length; ++j) {
                if ((i != ii) || (j != jj)) {
                    var bestID = -1;
                    var bestDist = -1;
                    for(var k = ((i == ii) && (j == jj)) ? kk + 1 : 0; k != this.paths[i][j].length; ++k) {
                        if (!(this.paths[i][j][k].length == 3)) {
                            var dist = distanceSqrd(this.paths[i][j][k], this.paths[ii][jj][kk]);
                            if ((dist < distance) && ((bestID < 0) || (bestDist > dist))) {
                                bestID = k;
                                bestDist = dist;
                            }
                        }
                    }
                    if (bestID >= 0) {
                        this.paths[i][j][bestID][2] = true;
                        sim.pts.push([i, j, bestID]);
                        sim.middle[0] += this.paths[i][j][bestID][0];
                        sim.middle[1] += this.paths[i][j][bestID][1];
                    }
                }
            }
        }
        return sim;
    }


    getSimilarPoints(distance) {
        var similarPoints = [];
        for(var i = 0; i != this.paths.length; ++i) {
            for(var j = 0; j != this.paths[i].length; ++j) {
                for(var k = 0; k != this.paths[i][j].length; ++k) {
                    if (!(this.paths[i][j][k].length == 3)) { // if not seen before
                        var sim = this.getSimilarPointsToFirst(this.paths[i][j][k], i, j, k, distance);
                        if (sim.pts.length > 1) {
                            sim.middle[0] /= sim.pts.length;
                            sim.middle[1] /= sim.pts.length;
                            similarPoints.push(sim);
                        }
                    }
                }       
            }   
        }
        return similarPoints;
    }
    
    
        
        
    stickSimilarCurves(distance) {
        // if one vertex is very close (using the given distance) to another vertex
        // their coordinate becomes the middle of it
        var similarPoints = this.getSimilarPoints(distance);
        for(var p = 0; p != similarPoints.length; ++p) {
            for (var j = 0; j != similarPoints[p].pts.length; ++j) {
                var id = similarPoints[p].pts[j];
                this.paths[id[0]][id[1]][id[2]] = similarPoints[p].middle;
                
            }
        }
    }
    

    
    // merge paths with similar depth
    // since some of them can overlap
    mergePathsSameDepth() {
        var shapes = [];
        var depthsShapes = [];
        
        // for each depth
        var uDepths = this.depths.filter((v, i, a) => a.indexOf(v) === i);
        for(i = 0; i < uDepths.length; ++i) {
            // iteratively merge all paths at this depth using union
            var union = [];
            for(var j = 0; j < this.paths.length; j++) {
                if (this.depths[j] == uDepths[i]) {
                    if (union.length == 0)
                        union = [this.paths[j]];
                    else
                        union = martinez.union(union, this.paths[j]);
                }
            }
            
            // add the result in shapes
            for(var k = 0; k != union.length; ++k) {
                shapes.unshift(union[k]);
                depthsShapes.unshift(uDepths[i]);
            }
        }
        
        // set back the result 
        this.paths = shapes;
        this.depths = depthsShapes;
        
        this.adjustToPrecision();
    }
    
    // clip path using visibility
    clipPathsUsingVisibility() {
        var shapes = [];
        var depthsShapes = [];
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
                    newShapes = martinez.diff(TreeNode.splitIntoShapes(curPaths), this.silhouette);
                    
                    // the new this.silhouette is the union
                    this.silhouette = martinez.union(curPaths, this.silhouette);
                    this.silhouette = TreeNode.splitIntoShapes(this.silhouette);
                }

                // add it to the final data structure
                for(var k = 0; k != newShapes.length; ++k) {
                    var split = TreeNode.splitIntoShapes(newShapes[k]);

                    for(var j = 0; j < split.length; ++j) {
                        shapes.unshift(split[j]);
                        depthsShapes.unshift(this.depths[i]);
                    }
                }
                
            }
            
        }
        
        this.paths = shapes;
        this.depths = depthsShapes;
     
        this.adjustToPrecision();        
    }
    
    // fill paths it with triangles
    // and associate to each triangle the desired depth
    fillShapes(paths, depths = -1) {
        
        var fShapes = [];
        
        for(var i = 0; i != paths.length; ++i) {
            var vertices = toTHREE(paths[i][0]);
            var holes = paths[i].slice(1);
            for(var j = 0; j != holes.length; ++j) {
                holes[j] = toTHREE(holes[j]);
            }

            
            var reverse = !THREE.ShapeUtils.isClockWise(vertices);
            if (reverse) {
                vertices = vertices.reverse();
                for (var h = 0, hl = holes.length; h < hl; h ++) {
                    var ahole = holes[h];
                    if (THREE.ShapeUtils.isClockWise(ahole)) {
                        holes[h] = ahole.reverse();
                    }
                }
            }
            
            var faces = THREE.ShapeUtils.triangulateShape(vertices, holes);
            
            var finalvertices = vertices;
            for (var j = 0; j <holes.length; j++) {
                finalvertices = finalvertices.concat(holes[j]);
            }
            
            if (depths == -1)
                fShapes.push({points: finalvertices, faces: faces});
            else
                fShapes.push({points: finalvertices, faces: faces, depth: depths[i]});
        }
        
        return fShapes;
        
    }

    
    
    // return the minimum depth value (or 0)
    minShapeDepth() {
        var d = 0;
        
        for(var i = 0; i != this.shapes.length; ++i)
            if (this.shapes.depth < d)
                d = this.shapes.depth;
        
        return d;
    }


    createUpperPart(geometry) {
        // add all the vertices of the upper part
        for(var i = 0; i != this.shapes.length; ++i) {
            for (var j = 0; j != this.shapes[i].points.length; ++j) {
                geometry.vertices.push(new THREE.Vector3(this.shapes[i].points[j].x, this.shapes[i].points[j].y, this.shapes[i].depth));
            }
        }
     
        // add all triangles of the upper part
        var idPoints = 0;
        for(var i = 0; i != this.shapes.length; ++i) {
            for(var j = 0; j != this.shapes[i].faces.length; ++j) {
                geometry.faces.push(new THREE.Face3(this.shapes[i].faces[j][0] + idPoints, 
                                                    this.shapes[i].faces[j][2] + idPoints, 
                                                    this.shapes[i].faces[j][1] + idPoints));
            }
            // next points will be added at the end of the mesh and will require a shift
            idPoints += this.shapes[i].points.length;
        }
        return geometry;
    }
    
    createLowerPart(geometry, baseDepth) {

        var underFaceZ = this.minShapeDepth() - baseDepth;
        
        // get the number of points in the upper part
        var idPointsAfterUp = geometry.vertices.length;
        
        // add all the vertices of the lower part        
        for(var i = 0; i != this.silhouetteShapes.length; ++i) {
            for (var j = 0; j != this.silhouetteShapes[i].points.length; ++j) {
                geometry.vertices.push(new THREE.Vector3(this.silhouetteShapes[i].points[j].x, 
                                                         this.silhouetteShapes[i].points[j].y, underFaceZ));
            }
        }


        
        // add all triangles of the lower part
        var idPoints = 0;
        for(var i = 0; i != this.silhouetteShapes.length; ++i) {
            // add all triangles of the under part (reverse order)
            for(var j = 0; j != this.silhouetteShapes[i].faces.length; ++j) {
                geometry.faces.push(new THREE.Face3(this.silhouetteShapes[i].faces[j][0] + idPointsAfterUp + idPoints, 
                                                    this.silhouetteShapes[i].faces[j][1] + idPointsAfterUp + idPoints, 
                                                    this.silhouetteShapes[i].faces[j][2] + idPointsAfterUp + idPoints));
            }
            
            // next points will be added at the end of the mesh and will require a shift
            idPoints += this.silhouetteShapes[i].points.length;
        }
        
        return geometry;
    }

    getVertex(triangle, id) {
        if (id == 0) return triangle.a;
        else if (id == 1) return triangle.b;
        else return triangle.c;
    }
    getBoundaryEdges(geometry) {
        var result = [];
        
        // build a list of all the edges, but remove an
        // edge if the same edge (other direction) is already
        // in the list
        for(var i = 0; i != geometry.faces.length; ++i) {
            for(var j = 0; j != 3; ++j) {
                var v1 = this.getVertex(geometry.faces[i], j);
                var v2 = this.getVertex(geometry.faces[i], (j + 1) % 3);
                var len = result.length;
                result = result.filter(x => !((x[0] == v2) && (x[1] == v1)));
                if (len == result.length)
                    result.push([v1, v2]);
            }
        }
                
        return result;
    }
    
    getPointsSame2DLocationPt(geometry, pointID) {
        var point = geometry.vertices[pointID];
        var result = [];
        for(var i = 0; i != geometry.vertices.length; ++i) {
            var p = geometry.vertices[i];
            if ((i != pointID) && (p.x == point.x) && (p.y == point.y))
                result.push(i);
        }
        return result;
    }
    
    getPointsSame2DLocation(geometry, bEdges) {
        var result = {};
        
        for(var i = 0; i != bEdges.length; ++i) {
            if (!(bEdges[i][0] in result)) {
                result[bEdges[i][0]] = this.getPointsSame2DLocationPt(geometry, bEdges[i][0]);
            }
            if (!(bEdges[i][1] in result)) {
                result[bEdges[i][1]] = this.getPointsSame2DLocationPt(geometry, bEdges[i][1]);
            }
        }
        
        return result;
    }
    
    // get the list of all edges whitch vertices are
    // at the same (x, y) location as the ones of the given edge
    getOtherEdges(edge, bEdges, sPoints) {
        var pts1 = sPoints[edge[0]];
        var pts2 = sPoints[edge[1]];
        return bEdges.filter(e => (((e[0] != edge[0]) || (e[1] != edge[1])) && 
                                    (((pts1.indexOf(e[0]) != -1) && (pts2.indexOf(e[1]) != -1)) ||
                                     ((pts1.indexOf(e[1]) != -1) && (pts2.indexOf(e[0]) != -1)))));
    }
    
    isUpperEdge(edge, bEdges, sPoints, geometry) {
        var others = this.getOtherEdges(edge, bEdges, sPoints);
        var z = geometry.vertices[edge[0]].z;
        for(var i = 0; i < others.length; ++i) {
            if (z < geometry.vertices[others[i][0]].z)
                return false;
        }
        return true;
    }
    
    // given sides=[s1, s2] a pair of vertex id lists,
    // sort them using z coordinate, and keep only vertices
    // between the first and last edges.
    filterVerticesBetweenEdges(sides, bEdges, geometry) {
        
        // sort vertices along Z axis on each line
        sides[0].sort(function(a, b) { return geometry.vertices[a].z - geometry.vertices[b].z;});
        sides[1].sort(function(a, b) { return geometry.vertices[a].z - geometry.vertices[b].z;});

        // get the list of edges within this subpart of the mesh
        var lEdges = bEdges.filter(e => (((sides[0].indexOf(e[0]) != -1) && (sides[1].indexOf(e[1]) != -1)) ||
                                         ((sides[1].indexOf(e[0]) != -1) && (sides[0].indexOf(e[1]) != -1))));
        
        
        // get vertices in these edges
        var eVerts = [].concat.apply([], lEdges);

        // remove top and bottom vertices not involved in an edge
        while(eVerts.indexOf(sides[0][0]) == -1) { sides[0].shift(); }
        while(eVerts.indexOf(sides[1][0]) == -1) { sides[1].shift(); }
        
        while(eVerts.indexOf(sides[0][sides[0].length - 1]) == -1) { sides[0].pop(); }
        while(eVerts.indexOf(sides[1][sides[1].length - 1]) == -1) { sides[1].pop(); }

        return sides;
    }
    
    addSideFromEdge(edge, sPoints, geometry, bEdges) {
        
        var sides = [sPoints[edge[0]], sPoints[edge[1]]];
        sides = [[edge[0]].concat(sides[0]), [edge[1]].concat(sides[1])];
        sides = this.filterVerticesBetweenEdges(sides, bEdges, geometry);

        if (((sides[0].length == 1) && (sides[1].length == 1)) ||
            (sides[0].length == 0) || (sides[1].length == 0)) {
            console.log("WARNING: empty side on edge", edge);
            return geometry;
        }
        
        if (sides[0].length > 1) {
            for(var i = 1; i < sides[0].length; ++i) {
                geometry.faces.push(new THREE.Face3(sides[0][i], sides[0][i - 1], sides[1][0]));
            }
        }
        if (sides[1].length > 1) {
            for(var i = 1; i < sides[1].length; ++i) {
                geometry.faces.push(new THREE.Face3(sides[1][i], sides[0][sides[0].length - 1], sides[1][i - 1]));
            }
        }

        return geometry;
    }
    
    addSideFromEdges(geometry, bEdges, sPoints) {
        for(var i = 0; i < bEdges.length; ++i) {
            if (this.isUpperEdge(bEdges[i], bEdges, sPoints, geometry)) {
                geometry = this.addSideFromEdge(bEdges[i], sPoints, geometry, bEdges);
            }
        }
        return geometry;
    }
    
    addSides(geometry) {
        // identify all the boundary edges in the geometry
        var bEdges = this.getBoundaryEdges(geometry);
        
        // find all the points of the boundary with same (x, y) location
        var sPoints = this.getPointsSame2DLocation(geometry, bEdges);
        
        // for each boundary edge, build the vertical wall creating all the required 
        // triangles
        return this.addSideFromEdges(geometry, bEdges, sPoints);
        
    }
    
    create3DFromShapes(baseDepth) {
        
        // create a new geometry
        var geometry = new THREE.Geometry();
        
        geometry = this.createUpperPart(geometry);
        
        geometry = this.createLowerPart(geometry, baseDepth);
        
        geometry = this.addSides(geometry);
        
        return geometry;
    }

    
    create3DShape(baseDepth, wantInvertedType, material) {
        // remove not visible regions
        this.clipPathsUsingVisibility();
        
        // merge regions with similar depth
        this.mergePathsSameDepth();
        
        // fill shapes
        this.shapes = this.fillShapes(this.paths, this.depths);
        this.silhouetteShapes = this.fillShapes(this.silhouette);
        
        // create 3D geometry from shapes
        var extruded = this.create3DFromShapes(baseDepth);
        
        
        // Use negative scaling to invert the image
        // flip the image to change from SVG orientation to Three.js orientation
        if(!wantInvertedType) {
            var invertTransform = new THREE.Matrix4().makeScale( -1, 1, 1 );
            extruded.applyMatrix4(invertTransform);
        }
        
        // Rotate 180 deg
        // Different coordinate systems for SVG and three.js
        var rotateTransform = new THREE.Matrix4().makeRotationZ( Math.PI );
        extruded.applyMatrix4(rotateTransform);

        extruded.computeFaceNormals();
        
        // create the mesh corresponding to this geometry
        var mesh = new THREE.Mesh(extruded, material);
        
        // So that these attributes of the mesh are populated for later
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        return mesh;
    }

}



