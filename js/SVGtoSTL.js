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
    var finalObj = getExtrudedSvgObject( paths, viewBox, svgColors, options);


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
        group.add( normals );
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


// The orientation of the shapes is defined by the first one.
// the resulting structure is a list of paths
function THREEShapesToClipperPaths(shapes) {
    var result = [];
    for (j = 0; j < shapes.length; j++) {
        pts = shapes[j].extractPoints(40);
        
        // the first element decides for the orientation
        orientation = ClipperLib.Clipper.Orientation(pts.shape);
        tpoints = [pts.shape].concat(pts.holes);

        for(p = 0; p != tpoints.length; p++) {
            cp = [];
            for(q = 0; q != tpoints[p].length; q++) {
                cp.push(new ClipperLib.IntPoint(tpoints[p][q].x, tpoints[p][q].y));
            }
            if (!orientation)
                cp.reverse();
            result.push(cp);
        }
        
        
    }
    return result;
}

function ClipperPolyNodeToTHREEShapes(polynode) {
    result = [];
    
    if (polynode != null) {
        // build the hole list
        var children = polynode.Childs();
        var pathHoles = [];
        for(i = 0; i != children.length; ++i) {
            pathHoles.push(children[i].Contour());
        }

        // add this first shape to the result list
        result.push(ClipperPathsToTHREEShapes([polynode.Contour()].concat(pathHoles)));
        
        // then add the other elements
        for(i = 0; i != children.length; ++i) {
            newShapes = children[i].Childs();
            if (newShapes.length != 0) {
                    for(j = 0; j != newShapes.length; ++j) {
                        result.push(ClipperPolyNodeToTHREEShapes(newShapes[j]));
                    }
            }
        }
    }
    
    return result;
}
    
    
function ClipperPathsToTHREEShapes(shapes) {
    for (var j = 0, l = shapes.length; j < l; j++) {
        if ((j == 0) && !ClipperLib.Clipper.Orientation(shapes[j]))
            console.log("ERROR: A first shape is not correctly oriented");
        if ((j != 0) && ClipperLib.Clipper.Orientation(shapes[j]))
            console.log("ERROR: A hole shape is not correctly oriented");
        
        var cpoints = [];
        for(p = 0; p != shapes[j].length; p++) {
            cpoints.push(new THREE.Vector2(shapes[j][p].X, shapes[j][p].Y));
        }
        // close the shape by adding the first point as last one
        cpoints.push(new THREE.Vector2(shapes[j][0].X, shapes[j][0].Y));
        
        // the first path is the main path
        if (j == 0)
            points = new THREE.Shape(cpoints);
        else {
            // the others are the holes
            points.holes.push(new THREE.Path(cpoints));
        }
        
    }
    return points;
}

// discretize paths and convert it to clipper.js format
function discretizeShapes(paths, options) {
    

    dpaths = [];
    if (paths.length > 0) { 
        for (var i = 0; i < paths.length; i++) {
            // Turn each SVG path into a three.js shape (that can be composed of a list of shapes)
            var path = d3.transformSVGPath( paths[i] );
            

            // extract shapes associated to the svg path
            // discretize them, and convert tem to clipper format
            var shapes = path.toShapes(options.svgWindingIsCW);
            dpaths.push(THREEShapesToClipperPaths(shapes));
        }
    }
    return dpaths;
    
}


function getBoundsOfShapes(paths) {
    
    var result = new ClipperLib.JS.BoundsOfPaths(paths[0]);
    
    for(i = 1; i < paths.length; ++i) {
        b = new ClipperLib.JS.BoundsOfPaths(paths[i]);
        if (b.left < result.left) result.left = b.left;
        if (b.top < result.top) result.top = b.top;
        if (b.right > result.right) result.right = b.right;
        if (b.bottom > result.bottom) result.bottom = b.bottom;
    }
    return result;
}

function addBasePlate(paths, viewBox, options) {
    // compute the effective bounding box, defined or by document margin, or by shapes
    if (options.ignoreDocumentMargins) {
        bbox = getBoundsOfShapes(dpaths);
    }
    else {
        bbox = new ClipperLib.IntRect(viewBox[0], viewBox[1], viewBox[2], viewBox[3]);
    }
    
    
    // add offset if required
    if (options.baseBuffer > 0) {
        buffer = options.baseBuffer / options.objectWidth * (bbox.right - bbox.left);
        bbox.left -= buffer;
        bbox.top -= buffer;
        bbox.right += buffer;
        bbox.bottom += buffer;
    }
    
    // create the final shape
    if(options.basePlateShape==="Rectangular") {
        // first turn it into a square if required
        if (options.squareBase) {
            width = bbox.right - bbox.left;
            height = bbox.bottom - bbox.top;
            middle = new IntPoint((bbox.left + bbox.right) / 2, (bbox.bottom + bbox.top) / 2);
            halfSize = (width > height ? width : height) / 2;
            bbox.left = middle.X - halfSize;
            bbox.right = middle.X + halfSize;
            bbox.top = middle.Y - halfSize;
            bbox.bottom = middle.Y + halfSize;
        }
        // then create the path
        plate = [ new ClipperLib.IntPoint(bbox.left, bbox.top),
                  new ClipperLib.IntPoint(bbox.right, bbox.top),
                  new ClipperLib.IntPoint(bbox.right, bbox.bottom),
                  new ClipperLib.IntPoint(bbox.left, bbox.bottom)];
        
    }
    // Otherwise a circle
    else {
        middle = new IntPoint((bbox.left + bbox.right) / 2, (bbox.bottom + bbox.top) / 2);
        corner = new IntPoint(bbox.left, bbox.top);
        radius = ClipperLib.DistanceSqrd(middle, corner);
        plate = [];
        for(i = 0; i != 128; i++) {
            plate.push(new ClipperLib.IntPoint(middle.X + radius * Math.cos(i / 128 * ClipperLib.PI2), 
                                               middle.Y + radius * Math.sin(i / 128 * ClipperLib.PI2)));
        }
    }
    
    paths.unshift([plate]);
    
    return paths;
}

// clip path using visibility, and convert it to THREE format
function clipPathsUsingVisibility(dpaths, idepths) {
    var shapes = [];
    var depths = [];
    var upperShape = [];
    if (dpaths.length > 0) { 
        // use inverse order to crop shapes according to their visibility
        for (var i = dpaths.length - 1; i >= 0; i--) {
            points = dpaths[i];
            
            // convert the path to clipper format and prepare for boolean operations
            var cpr = new ClipperLib.Clipper();
            cpr.AddPaths(points, ClipperLib.PolyType.ptSubject, true);
            
            // if an upper shape already exists, we add it
            if (shapes.length != 0) {
                cpr.AddPaths(upperShape, ClipperLib.PolyType.ptClip, true);
            }
            
            // compute the visible part of this shape
            difference = new ClipperLib.PolyTree();
            cpr.Execute(ClipperLib.ClipType.ctDifference, difference, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            // then process the PolyNode to generate THREE shapes (possibly with holes)
            
            // add it to the final data structure
            var polynodes = difference.Childs();
            for(k = 0; k != polynodes.length; ++k) {
                nshapes = ClipperPolyNodeToTHREEShapes(polynodes[k]);
                shapes = nshapes.concat(shapes);
                for(j = 0; j < nshapes.length; j++) {
                    depths.unshift(idepths[i]);
                }
            }
            
            
            // compute the new upper part
            cpr.Execute(ClipperLib.ClipType.ctUnion, upperShape, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
            
        }
        
    }
    return {shapes: shapes, depths: depths};
}
    

// center and rescale to match the desired width
function rescaleAndCenter(dpaths, width) {
    bbox = getBoundsOfShapes(dpaths);
    ratio = width / (bbox.right - bbox.left);
    center = new ClipperLib.IntPoint((bbox.left + bbox.right) / 2, (bbox.bottom + bbox.top) / 2);
    
    for(i = 0; i < dpaths.length; ++i) {
            for(j = 0; j < dpaths[i].length; ++j) {
                for(k = 0; k < dpaths[i][j].length; ++k) {
                    dpaths[i][j][k] = new ClipperLib.IntPoint((dpaths[i][j][k].X - center.X) * ratio, (dpaths[i][j][k].Y - center.Y) * ratio);
                }
            }
    }
    
    return dpaths;
    
}

// given a list of THREE shapes, it fills it with triangles
// and associate to each triangle the desired depth
function fillShapes(shapes, depths) {
    
    fShapes = [];
    
    for(i = 0; i != shapes.length; ++i) {
        pts = shapes[i].extractPoints();
        var vertices = pts.shape;
        var holes = pts.holes;

        var reverse = !THREE.ShapeUtils.isClockWise(vertices);
        if (reverse) {
            vertices = vertices.reverse();
            for (h = 0, hl = holes.length; h < hl; h ++) {
                ahole = holes[h];
                if (THREE.ShapeUtils.isClockWise(ahole)) {
                    holes[h] = ahole.reverse();
                }
            }
        }
        
        faces = THREE.ShapeUtils.triangulateShape(vertices, holes);
        
        finalvertices = vertices;
        for (j = 0; j <holes.length; j++) {
            finalvertices = finalvertices.concat(holes[j]);
        }
        
        fShapes.push({points: finalvertices, faces: faces, depth: depths[i]});
    }
    
    return fShapes;
    
}

// return the minimum depth value (or 0)
function minDepth(shapes) {
    d = 0;
    
    for(i = 0; i != shapes.length; ++i)
        if (shapes.depth < d)
            d = shapes.depth;
    
    return d;
}

function create3DFromShapes(shapes, baseDepth) {
    // create a new geometry
    var geometry = new THREE.Geometry();
    
    underFaceZ = minDepth(shapes) - baseDepth;
    
    
    for(i = 0; i != shapes.length; ++i) {
        
        for (j = 0; j != shapes[i].points.length; ++j) {
            // add all the vertices of the upper part
            geometry.vertices.push(new THREE.Vector3(shapes[i].points[j].x, shapes[i].points[j].y, shapes[i].depth));
        }
    }
    idPointsUp = geometry.vertices.length;
    
    for(i = 0; i != shapes.length; ++i) {
        for (j = 0; j != shapes[i].points.length; ++j) {
            // and triangles of the lower part
            geometry.vertices.push(new THREE.Vector3(shapes[i].points[j].x, shapes[i].points[j].y, underFaceZ));
        }
    }

    idPoints = 0;

    for(i = 0; i != shapes.length; ++i) {

        // add all triangles of the upper part
        for(j = 0; j != shapes[i].faces.length; ++j) {
            geometry.faces.push(new THREE.Face3(shapes[i].faces[j][0] + idPoints, shapes[i].faces[j][1] + idPoints, shapes[i].faces[j][2] + idPoints));
        }

        // add all triangles of the under part (reverse order)
        for(j = 0; j != shapes[i].faces.length; ++j) {
            geometry.faces.push(new THREE.Face3(shapes[i].faces[j][2] + idPointsUp + idPoints, 
                                                shapes[i].faces[j][1] + idPointsUp + idPoints, 
                                                shapes[i].faces[j][0] + idPointsUp + idPoints));
        }
        
        // next points will be added at the end of the mesh and will require a shift
        idPoints += shapes[i].points.length;
    }
    
    // TODO: add side triangles
    
    return geometry;
}

function getSimilarPointsToFirst(point, ii, jj, kk, paths, distance) {
    var sim = { middle: new ClipperLib.IntPoint(point.X, point.Y), pts: [[ii, jj, kk]] };
    for(var i = ii; i != paths.length; ++i) {
        for(var j = (i == ii) ? jj : 0; j != paths[i].length; ++j) {
            bestID = -1;
            bestDist = -1;
            for(var k = ((i == ii) && (j == jj)) ? kk + 1 : 0; k != paths[i][j].length; ++k) {
                dist = ClipperLib.Clipper.DistanceSqrd(paths[i][j][k], paths[ii][jj][kk]);
                
                if ((dist < distance) && ((bestID < 0) || (bestDist > dist))) {
                    bestID = k;
                    bestDist = dist;
                }
            }
            if (bestID >= 0) {
                paths[i][j][bestID].seen = true;
                sim.pts.push([i, j, bestID]);
                sim.middle.X += paths[i][j][bestID].X;
                sim.middle.Y += paths[i][j][bestID].Y;
            }
        }
    }
    return sim;
}


function getSimilarPoints(paths, distance) {
    var similarPoints = [];
    for(var i = 0; i != paths.length; ++i) {
        for(var j = 0; j != paths[i].length; ++j) {
            for(var k = 0; k != paths[i][j].length; ++k) {
                if (!('seen' in paths[i][j][k])) {
                    sim = getSimilarPointsToFirst(paths[i][j][k], i, j, k, paths, distance);
                    if (sim.pts.length > 1) {
                        sim.middle.X /= sim.pts.length;
                        sim.middle.Y /= sim.pts.length;
                        similarPoints.push(sim);
                    }
                }
            }       
        }   
    }
    return similarPoints;
}

// return distance between a point C and a segment [A, B]
// or -1 if the nearest point along (A, B) line is ouside of the segment [A, B]
function distancePointSegment(C, A, B, epsilon) {
    // cf http://www.faqs.org/faqs/graphics/algorithms-faq/
    // Subject 1.02: How do I find the distance from a point to a line?
    L2 = ClipperLib.Clipper.DistanceSqrd(A, B);
    if (L2 <= epsilon)
        return -1;
    r = ((C.X - A.X) * (B.X - A.X) + (C.Y - A.Y) * (B.Y - A.Y)) / L2;

    if ((r < 0) || (r > 1))
        return -1;
    else {
        Px = A.X + r * (B.X - A.X);
        Py = A.Y + r * (B.Y - A.Y);
        
        return ClipperLib.Clipper.DistanceSqrd(C, new ClipperLib.IntPoint(Px, Py));
    }
}

function addPointInEdges(point, ii, jj, paths, distance) {
    for(var i = 0; i != paths.length; ++i) {
        for(var j = 0; j != paths[i].length; ++j) {
            // only process the path if it does not contain point
            if ((ii != i) || (jj != j)) {
                if (paths[i][j].length >= 2) {
                    bestID = -1;
                    bestDist = -1;
                    for(var k = 0; k != paths[i][j].length; ++k) {
                        current = paths[i][j][k];
                        next = paths[i][j][(k + 1) % paths[i][j].length];
                        dist = distancePointSegment(point, current, next, distance / 5);
                        dc = ClipperLib.Clipper.DistanceSqrd(current, point);
                        dn = ClipperLib.Clipper.DistanceSqrd(next, point);
                        if ((dc > distance) && (dn > distance) &&
                            (dist >= 0.) && (dist < distance) && ((bestID < 0) || (bestDist > dist))) {                        
                            bestID = k;
                            bestDist = dist;
                        }
                    }
                    if (bestID >= 0) {
                        paths[i][j].splice(bestID + 1, 0, new ClipperLib.IntPoint(point.X, point.Y));
                        break;
                    }
                }
            }
        }
    }


}

function stickSimilarCurves(paths, distance) {
    // if one vertex is very close (using the given distance) to another vertex
    // their coordinate becomes the middle of it
    similarPoints = getSimilarPoints(paths, distance);
    for(var p = 0; p != similarPoints.length; ++p) {
        for (var j = 0; j != similarPoints[p].pts.length; ++j) {
            id = similarPoints[p].pts[j];
            paths[id[0]][id[1]][id[2]] = similarPoints[p].middle;
        }
    }
        
    
    
    // if a point is very close (using the given distance) to an edge of another
    // path, this edge is split, adding a point at this location
    added = [];
    for(var i = 0; i != paths.length; ++i) {
        for(var j = 0; j != paths[i].length; ++j) {
            for(var k = 0; k != paths[i][j].length; ++k) {
                addPointInEdges(paths[i][j][k], i, j, paths, distance);
            }
        }
    }
    
    return paths;
}
    
// Creates a three.js Mesh object out of SVG paths
function getExtrudedSvgObject( paths, viewBox, svgColors, options ) {
    
    // discretize paths and convert it to clipper.js format
    dpaths = discretizeShapes(paths, options);
    
    // If we wanted a base plate, let's add a supplementary path
    if(options.wantBasePlate) {
        dpaths = addBasePlate(dpaths, viewBox, options);
    }
    
    // center and scale the shapes
    dpaths = rescaleAndCenter(dpaths, options.objectWidth - (options.baseBuffer * 2));
    
    
    // stick similar curves 
    if (options.mergeDistance > 0) {
        dpaths = stickSimilarCurves(dpaths, options.mergeDistance);
    }
    
    // get the depths following the colors of the svg mesh
    depths = [];
    for(i = 0; i < svgColors.length; ++i) {
        depths.push(options.typeDepths[svgColors[i]]);
    }
    // and the default depth for the plate if it exists
    if(options.wantBasePlate) {
        depths.unshift(0.0);
    }
    
    // clip paths using visibility, and convert it to THREE.js format
    shapesAndDepths = clipPathsUsingVisibility(dpaths, depths);
    shapes = shapesAndDepths.shapes;
    depths = shapesAndDepths.depths;

    
    // fill shapes
    shapes = fillShapes(shapes, depths);
    
    // create 3D geometry from shapes
    extruded = create3DFromShapes(shapes, options.baseDepth);
    
    
    // Use negative scaling to invert the image
    // flip the image to change from SVG orientation to Three.js orientation
    if(!options.wantInvertedType) {
        var invertTransform = new THREE.Matrix4().makeScale( -1, 1, 1 );
        extruded.applyMatrix4( invertTransform );
    }
      
    // Rotate 180 deg
    // Different coordinate systems for SVG and three.js
    var rotateTransform = new THREE.Matrix4().makeRotationZ( Math.PI );
    extruded.applyMatrix4(rotateTransform);
    
    // create the mesh corresponding to this geometry
    var mesh = new THREE.Mesh(extruded, options.material);
    
    // So that these attributes of the mesh are populated for later
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    return mesh;
};

