// Removes all children from a three.js group
function clearGroup(group) {
    for (var i = group.children.length; i >= 0; i--) {
        group.remove(group.children[i]);
    }
}


function sameLocationXY(v1, v2) {
    return v1.x == v2.x && v1.y == v2.y;
}

function getMaximumSize(mesh) {
    if (mesh.geometry.vertices.length == 0) {
        return 1;
    }
    
    var bbox = Box.fromXY(mesh.geometry.vertices);
    
    return bbox.getMaximumSize();
    
}


// Takes an SVG structure, and returns a scene to render as a 3D STL
function renderObject(vertices, faces, group, camera, options) {
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


    var geometry = new THREE.Geometry();
    for(var v of vertices) {
        geometry.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
    }
    for (var f of faces) {
        geometry.faces.push(new THREE.Face3(f.a, f.b, f.c));
    }
    
    var finalObj = new THREE.Mesh(geometry, options.material);
    
    var width = getMaximumSize(finalObj);

    // Add the merged geometry to the scene
    group.add(finalObj);
    
    // change zoom wrt the size of the mesh
    camera.position.set(0, -width, width);
    controls.target.set(0, 0, 0);
    controls.update();


    // Show the wireframe?
    if(options.wantWireFrame) {
        var wireframe = new THREE.WireframeGeometry(finalObj.geometry);
        var lines = new THREE.LineSegments(wireframe);
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
        var edges = new THREE.EdgesGeometry(finalObj.geometry);
        var lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial( { color: 0xffffff } ));
        group.add(lines);
    }
    
    /// add backgroup a background grid
    var helper = new THREE.GridHelper( width * 1.2, 10 );
    helper.rotation.x = Math.PI / 2;
    group.add(helper);
    
    finalObj.geometry.computeBoundingBox();
    
    return { vertices : finalObj.geometry.vertices.length, faces : finalObj.geometry.faces.length,
             bbox : finalObj.geometry.boundingBox, isValidMesh: SVG3DScene.getNonValidEdges(finalObj.geometry).length == 0 };
};


// Creates a Mesh (list of vertices and faces) out of SVG paths
function getExtrudedSvgObject(svgStructure, options) {
        
    // get the depths following the colors of the svg mesh
    var depths = [];
    for(var i = 0; i < svgStructure.getColors().length; ++i) {
        depths.push(options.typeDepths[svgStructure.getColors()[i]]);
    }

    // load svg paths into a scene (discretize the curves, to only manipulate polygons)
    var scene = new SVG3DScene(svgStructure.getShapes(), depths, 
                               svgStructure.getSilhouette());
        
    // stick similar curves if required
    if (options.mergeDistance > 0) {
        postMessage(["progress", "stickSimilarCurves"]);
        scene.stickSimilarCurves(options.mergeDistance);
    }
    postMessage(["progress", "create3Dshape"]);

    // finally, generate 3D shapes with an extrude process
    return scene.create3DShape(options.baseDepth, options.wantInvertedType);


};


/** 
 ** 
 ** Utils
 **  
 **  
 **/

function pt2List(v) {
        return [v.x, v.y];
}

function edgesContains(listEdges, e) {
            for(var t = 0; t != listEdges.length; ++t) {
                if (((listEdges[t].ids[0] == e.ids[0]) && (listEdges[t].ids[1] == e.ids[1])) ||
                    ((listEdges[t].ids[1] == e.ids[0]) && (listEdges[t].ids[0] == e.ids[1])))
                    return true;
            }
            return false;
};
        

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








/** 
 ** 
 ** class SVG3DScene: a class to convert SVG paths to 3D shape
 **  
 **  
 **/
class SVG3DScene {
    
    constructor(shapes, depths, silhouette) {
        postMessage(["progress", "shapeToListPath"]);
        this.paths = SVGShape2D.shapesToList(shapes);
        postMessage(["progress", "shapeToListSilhouette"]);
        this.silhouette = SVGShape2D.shapesToList(silhouette);
        this.depths = depths;
        
    }
    


    // TODO: use RBush
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
                    // TODO: do we need to use improvments from SVGShape2D using RBush?
                    if (union.length == 0)
                        union = [this.paths[j]];
                    else {
                        union = martinez.union(union, [this.paths[j]]);
                    }
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
        
    }
    
    
    
    findNeighborNotNull(list, id, step) {
        var res = id;
        do {
            if ((res == list.length - 1) && step == 1)
                res = 0;
            else if ((res == 0) && step == -1)
                res = list.length - 1;
            else
                res += step;
            if (res == id) {
                console.log("WARNING: unable to find a triangle in this shape");
                return null;
            }
        } while (list[res] == 0);
        return res;
    }
    

    
    findAndSplitTriangle(triangles, p1, p2, newPoint) {
        for(var i = 0; i < triangles.length; ++i) {
            var idp1 = triangles[i].indexOf(p1);
            var idp2 = triangles[i].indexOf(p2);
            if ((idp1 != -1) && (idp2 != -1)) {
                    var t1 = triangles[i].slice();
                    t1[idp1] = newPoint;
                    var t2 = triangles[i].slice();
                    t2[idp2] = newPoint;
                    return {before: i, after: [t1, t2] };
            }
        }
        return null;
        
    }
    
    splitTrianglesAddMissingVertices(triangles, contour, holes) {
        var vertices = [contour].concat(holes);
        // first identify vertices that are not in a triangle
        var nbTriangles = [];
        var polygonFirstID = [];
        var nb = 0;
        for(var i = 0; i != vertices.length; ++i) {
            polygonFirstID.push(nb);
            for(var j = 0; j != vertices[i].length; ++j) {
                nbTriangles.push(0);
            }
            nb += vertices[i].length;
        }
        
        for(var i = 0; i < triangles.length; ++i) {
            nbTriangles[triangles[i][0]] += 1;
            nbTriangles[triangles[i][1]] += 1;
            nbTriangles[triangles[i][2]] += 1;
        }
        
        // then for each orphan vertex
        for(var i = 0; i != vertices.length; ++i) {
            for(var j = 0; j != vertices[i].length; ++j) {
                if (nbTriangles[polygonFirstID[i] + j] == 0) {
                    var subNbTriangles = nbTriangles.slice(polygonFirstID[i], polygonFirstID[i] + vertices[i].length);
                    var pred = this.findNeighborNotNull(subNbTriangles, j, -1);
                    var next = this.findNeighborNotNull(subNbTriangles, j, +1);
                    var finalID = polygonFirstID[i] + j;
                    if (pred == null || next == null) {
                        console.log("WARNING: unable to find a triangle for", finalID, vertices[i][j], " (border without triangle)");
                    }
                    else {
                        var t = this.findAndSplitTriangle(triangles, polygonFirstID[i] + pred, polygonFirstID[i] + next, 
                                                   polygonFirstID[i] + j);
                        if (t != null) {
                            console.log("Orphan vert", finalID, vertices[i][j], "found in triangle", triangles[t.before], "replaced by", t.after[0], t.after[1]);
                            triangles[t.before] = t.after[0];
                            triangles.push(t.after[1]);
                        }
                        else {
                            console.log("Unable to find a triangle for", finalID, vertices[i][j], ". Will be handled later.");
                        }
                    }
                }
            }
        }
        
        return triangles;
    }
    
    findEdgeReplaceTriangles(edges, target) {
        var epsilon = 1e-6;
        var best = null;
        var bestDist = -1;
        var bestID = -1;
        
        // find the best edge match
        for(var e = 0; e != edges.length; ++e) {
            var A = [edges[e].coords[0].x, edges[e].coords[0].y];
            var B = [edges[e].coords[1].x, edges[e].coords[1].y];
            var d1, d2;
            var e1 = false, e2 = false;
            if (target.ids[0] == edges[e].ids[0] || target.ids[0] == edges[e].ids[1]) {
                d1 = 0;
                e1 = true;
            }
            else
                d1 = distanceSqrdPointSegment([target.coords[0].x, target.coords[0].y],
                                              A, B, epsilon);
            if (d1 >= 0) {
                if (target.ids[1] == edges[e].ids[0] || target.ids[1] == edges[e].ids[1]) {
                    d2 = 0;
                    e2 = true;
                }
                else
                    d2 = distanceSqrdPointSegment([target.coords[1].x, target.coords[1].y],
                                                  A, B, epsilon);
                if (d2 >= 0) {
                    // the target is inside the edge. This edge becomes the best one
                    var d = d1 + d2;
                    if ((best == null) || bestDist > d) {
                        best = edges[e];
                        bestID = e;
                        best.ext = [ e1, e2 ];
                        bestDist = d;
                    }
                }
            }
        }
        
        // if a good edge candidate has been found
        if (best != null && !(best.ext[0] && best.ext[1])) {
            if (best.ext[0] && best.ext[1]) {
                return null;
            }
            var idp1 = best.tr.indexOf(best.ids[0]);
            var idp2 = best.tr.indexOf(best.ids[1]);
            
            if (best.ext[0]) { // this new edge share its first vertex with the edge already in a triangle
                var t1 = best.tr.slice(); // copy the triangle
                t1[idp1] = target.ids[1]; // replace the id with the other vertex
                var t2 = best.tr.slice(); // copy the triangle
                t2[idp2] = target.ids[1]; // replace the id with the other vertex
                return {before: best.trID, after: [t1, t2] };
            }
            else if (best.ext[1]) {  // this new edge share its second vertex with the edge already in a triangle
                var t1 = best.tr.slice(); // copy the triangle
                t1[idp1] = target.ids[0]; // replace the id with the other vertex
                var t2 = best.tr.slice(); // copy the triangle
                t2[idp2] = target.ids[0]; // replace the id with the other vertex
                return {before: best.trID, after: [t1, t2] };                
            }
            else {
                // both vertices of the new edge are inside the edge already in a triangle
                // the triangle will be splitten into 3 triangles
                var t1 = best.tr.slice(); 
                var t2 = best.tr.slice();
                var t3 = best.tr.slice();
                // decide on the ordering
                var goodOrder = distanceSqrd(pt2List(best.coords[0]), pt2List(target.coords[0])) <
                                distanceSqrd(pt2List(best.coords[0]), pt2List(target.coords[1]));
                var idN1 = goodOrder ? target.ids[0] : target.ids[1];
                var idN2 = goodOrder ? target.ids[1] : target.ids[0];
                t1[idp2] = idN1;
                t2[idp1] = idN1;
                t2[idp2] = idN2;
                t3[idp1] = idN2;
                
                return {before: best.trID, after: [t1, t2, t3] };                
            }
        }
        else {
            return null;
        }
    }
    
    findEdgeID(edges, edge) {
        for(var i = 0; i != edges.length; ++i) {
            if ((edges[i].ids[0] == edge[0] && edges[i].ids[1] == edge[1]) ||
                (edges[i].ids[0] == edge[1] && edges[i].ids[1] == edge[0]))
                return i;
        }
        return -1;
    }

    reintroduceMissingEdges(triangles, contour, holes) {
        var contours = [contour].concat(holes);
        
        // build a list of all the contour edges
        var edges = [];
        var nb = 0;
        for(var i = 0; i != contours.length; ++i) {
            if (contours[i].length > 1) {
                for(var j = 0; j != contours[i].length; ++j) {
                    edges.push({ ids: [nb + j, nb + (j + 1) % contours[i].length],
                                 coords: [contours[i][j], contours[i][(j + 1) % contours[i].length]]});
                }
            }
            nb += contours[i].length;
        }
        
        // build a flat list of all the vertices
        var vertices = contour;
        for (var j = 0; j <holes.length; j++) {
            vertices = vertices.concat(holes[j]);
        }

        
        // build a list of all the edges along the border of the triangulated region 
        // (do not keep inner edges)

        var tEdges = SVG3DScene.getBoundaryEdgesFromLists(vertices, triangles);
                
        // keep only edges that are not in the triangles
        edges = edges.filter(e => !edgesContains(tEdges, e));

        for(var e = 0; e != edges.length; ++e) {

            var t = this.findEdgeReplaceTriangles(tEdges, edges[e]);

            if (t != null) {
                var oEdges = [ [triangles[t.before][0], triangles[t.before][1]],
                               [triangles[t.before][1], triangles[t.before][2]],
                               [triangles[t.before][2], triangles[t.before][0]]];
                triangles[t.before] = t.after[0];
                
                for(var i = 0; i != 3; ++i) {
                    var idE = this.findEdgeID(tEdges, oEdges[i]);
                    if (idE > 0) { // if it is a boundary edge
                        tEdges[idE] = SVG3DScene.buildBorderEdgeDescription(triangles, vertices, t.before, i, (i + 1) %3);
                    }

                }

                for(var i = 1; i < t.after.length; ++i) {
                    triangles.push(t.after[i]);
                    for(var j = 0; j != 3; ++j) {
                        tEdges.push(SVG3DScene.buildBorderEdgeDescription(triangles, vertices, triangles.length - 1, j, (j  + 1) % 3));
                    }
                }
            }
            else {
                console.log("Unable to find a triangle for edge ", e);
            }
        }
        
        return triangles;
        
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
            
            // build triangles
            var faces = THREE.ShapeUtils.triangulateShape(vertices, holes);
            
            // modify the triangle data structure to avoid orphan vertices
            faces = this.splitTrianglesAddMissingVertices(faces, vertices, holes);
            
            // reintroduce possible missing edges
            faces = this.reintroduceMissingEdges(faces, vertices, holes);
            
            // build list of vertices
            var finalvertices = vertices;
            for (var j = 0; j <holes.length; j++) {
                finalvertices = finalvertices.concat(holes[j]);
            }

            // add this shape to the final data structure
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

    

    
    getEdgesSame2DLocation(geometry, bEdges) {
        var result = {};
        
        for(var box of bEdges.all()) {
            var bIndex = box.edge[0] + "-" + box.edge[1];
            var vs = [geometry.vertices[box.edge[0]], geometry.vertices[box.edge[1]]];

            var interBoxes = bEdges.search(box);
            result[bIndex] = [];
            
            for(var ib of interBoxes) {
                var e = ib.edge;
                if ((e[0] != box.edge[0]) || (e[1] != box.edge[1])) {
                    for (var i = 0; i != 2; ++i) {
                        for(var idP of e) {
                            if (geometry.vertices[idP].x == vs[i].x &&
                                geometry.vertices[idP].y == vs[i].y)
                                result[bIndex].push(e);
                                break;
                        }
                    }
                }
            }
        }
        
        return result;
    }
    
    // get the list of all edges in SEdges which both vertices are
    // at the same (x, y) location as the ones of the given edge
    getOtherEdges(edge, sEdges, geometry) {
        var result = [];
        var v1 = geometry.vertices[edge[0]];
        var v2 = geometry.vertices[edge[1]];
        
        for(var e of sEdges) {
            var ev1 = geometry.vertices[e[0]];
            var ev2 = geometry.vertices[e[1]];
            if ((sameLocationXY(v1, ev1) && sameLocationXY(v2, ev2)) ||
                (sameLocationXY(v1, ev2) && sameLocationXY(v2, ev1))) {
                result.push(e);
            }
        }
        return result;
    }
    
    isUpperEdge(edge, oEdges, geometry) {
        var z = geometry.vertices[edge[0]].z;
        for(var other of oEdges) {
            if (z < geometry.vertices[other[0]].z)
                return false;
        }
        return true;
    }
    
    // given sides=[s1, s2] a list of edges corresponding to these two sides,
    // sort them the sides using z coordinate, and keep only vertices
    // between the first and last edges.
    filterVerticesBetweenEdges(sides, lEdges, geometry) {
        
        // sort vertices along Z axis on each line
        // and remove doubles
        sides[0].sort(function(a, b) { return geometry.vertices[a].z - geometry.vertices[b].z;});
        sides[1].sort(function(a, b) { return geometry.vertices[a].z - geometry.vertices[b].z;});

        sides[0] = sides[0].filter(function(item, pos, ary) { return !pos || item != ary[pos - 1];});
        sides[1] = sides[1].filter(function(item, pos, ary) { return !pos || item != ary[pos - 1];});
        
        // get vertices in the similar edges
        var eVerts = [].concat.apply([], lEdges);

        // remove top and bottom vertices not involved in an edge
        while(eVerts.indexOf(sides[0][0]) == -1) { sides[0].shift(); }
        while(eVerts.indexOf(sides[1][0]) == -1) { sides[1].shift(); }
        
        while(eVerts.indexOf(sides[0][sides[0].length - 1]) == -1) { sides[0].pop(); }
        while(eVerts.indexOf(sides[1][sides[1].length - 1]) == -1) { sides[1].pop(); }

        return sides;
    }
    
    addSideFromEdge(edge,
                    sEdges, /* all edges sharing a vertex with the given edge */
                    oEdges, /* all edges at the same position as the given edge */
                    geometry) {
        
        var v1 = geometry.vertices[edge[0]];
        var v2 = geometry.vertices[edge[1]];
        
        // get all vertices at in the connected edges
        var eVerts = [].concat.apply([], sEdges);
        // get all points at the same location as edge[0] and edge[1]
        var sides = [eVerts.filter(id => sameLocationXY(geometry.vertices[id], v1)), 
                     eVerts.filter(id => sameLocationXY(geometry.vertices[id], v2))];
        
        // add edge
        sides = [[edge[0]].concat(sides[0]), [edge[1]].concat(sides[1])];
        
        
        // filter by removing all elements outside of the elements in oEdges
        sides = this.filterVerticesBetweenEdges(sides, [edge].concat(oEdges), geometry);

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
    
    addSideFromEdges(geometry, bEdges, sEdges) {
        for(var box of bEdges.all()) {
            var edge = box.edge;
            var bIndex = edge[0] + "-" + edge[1];
            var oEdges = this.getOtherEdges(edge, sEdges[bIndex], geometry);
            if (this.isUpperEdge(edge, oEdges, geometry)) {
                geometry = this.addSideFromEdge(edge, sEdges[bIndex], oEdges, geometry);
            }
        }
        return geometry;
    }
    
    addSides(geometry) {
        // identify all the boundary edges in the geometry
        var bEdges = SVG3DScene.getBoundaryEdgesRBush(geometry);
        
        // find all the edges of the boundary with a vertex at the same (x, y) location
        // as the edge
        var sEdges = this.getEdgesSame2DLocation(geometry, bEdges);
        
        
        // for each boundary edge, build the vertical wall creating all the required 
        // triangles
        return this.addSideFromEdges(geometry, bEdges, sEdges);
        
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
        
        postMessage(["progress", "mergeSimilarDepth"]);
        // merge regions with similar depth
        this.mergePathsSameDepth();
        
        postMessage(["progress", "fillShapes"]);
        // fill shapes
        this.shapes = this.fillShapes(this.paths, this.depths);
        this.silhouetteShapes = this.fillShapes(this.silhouette);
        
        postMessage(["progress", "extrudeShapes"]);
        // create 3D geometry from shapes
        var extruded = this.create3DFromShapes(baseDepth);
        
        postMessage(["progress", "fineTuning3D"]);
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
        var mesh = new THREE.Mesh(extruded);
        
        // So that these attributes of the mesh are populated for later
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();


        return { "vertices": mesh.geometry.vertices, "faces": mesh.geometry.faces};
    }

}


SVG3DScene.getVertex = function(triangle, id) {
    if (id == 0) return triangle.a;
    else if (id == 1) return triangle.b;
    else return triangle.c;
}
    
SVG3DScene.getNonValidEdges = function(geometry) {
    var result = [];
    
    var nbHalfEdges = {};
    // count the number of halfedges
    for(var i = 0; i != geometry.faces.length; ++i) {
        for(var j = 0; j != 3; ++j) {
            var v1 = SVG3DScene.getVertex(geometry.faces[i], j);
            var v2 = SVG3DScene.getVertex(geometry.faces[i], (j + 1) % 3);
            if (v1 == v2) { // two identical vertices in a triangle
                result.push([v1, v2]);
            }
            
            if (v2 > v1) {
                var v3 = v1;
                v1 = v2;
                v2 = v3;
            }
            var key = v1 + "," + v2;
            // count 
            if (key in nbHalfEdges) {
                nbHalfEdges[key] += 1;
            }
            else {
                nbHalfEdges[key];
            }
        }
    }
    
    // only keep edges with number != 2 (not manifold)
    for(var e in nbHalfEdges) {
        if (nbHalfEdges[e] != 2)
            var v = e.split(",");
            result.push([parseInt(v[0]), parseInt(v[1])]);
    }
            
    return result;
}

SVG3DScene.getOppositeBox = function(box, bbox, isOppositeBox = null) {
    var elems = bbox.search(box);
    for(var e of elems) {
        if (isOppositeBox) {
            if (isOppositeBox(e, box))
                return e;
        }
        else
            if (e.edge[0] == box.edge[1] && e.edge[1] == box.edge[0])
                return e;
    }
    return null;
}

SVG3DScene.getBoundaryEdgesRBush = function(geometry) {
    return SVG3DScene.getBoundaryEdgesRBushFromLists(geometry.vertices, geometry.faces, 
                                            function (p) {return p.x;},
                                            function (p) {return p.y;},
                                            SVG3DScene.getVertex,
                                            function(triangles, vertices, t, a, b) {
                                                return [SVG3DScene.getVertex(triangles[t], a),
                                                        SVG3DScene.getVertex(triangles[t], b)];
                                            },
                                            null
                                         );
    
}
SVG3DScene.getBoundaryEdgesFromLists = function(vertices, faces) {
    return SVG3DScene.getBoundaryEdgesRBushFromLists(vertices, faces,
                                            function (p) {return p.x;},
                                            function (p) {return p.y;},
                                            function (face, i) { return face[i]; },
                                            SVG3DScene.buildBorderEdgeDescription,
                                            function (box1, box2) { return box1.edge.ids[0] == box2.edge.ids[1] && 
                                                    box1.edge.ids[1] == box2.edge.ids[0]; }).all().map(b => b.edge);
}
SVG3DScene.buildBorderEdgeDescription = function(triangles, vertices, t, a, b) {
            return { ids : [triangles[t][a], triangles[t][b]], trID: t, tr: triangles[t], 
                        coords: [vertices[triangles[t][a]], vertices[triangles[t][b]]] }
}

SVG3DScene.getBoundaryEdgesRBushFromLists = function(vertices, faces, 
                                                     getXFunction, getYFunction,
                                                     getVertexFromTriangle,
                                                     buildEdge,
                                                     isOppositeBox
                                                    ) {
    var bbox = new rbush();
    
    // build a list of all the edges, but remove an
    // edge if the same edge (other direction) is already
    // in the list
    for(var i = 0; i != faces.length; ++i) {
        for(var j = 0; j != 3; ++j) {
            var v1 = getVertexFromTriangle(faces[i], j);
            var v2 = getVertexFromTriangle(faces[i], (j + 1) % 3);

            var p1 = vertices[v1];
            var p2 = vertices[v2];

            var box = {minX: Math.min(getXFunction(p1), getXFunction(p2)), 
                        minY: Math.min(getYFunction(p1), getYFunction(p2)), 
                       maxX: Math.max(getXFunction(p1), getXFunction(p2)), 
                        maxY: Math.max(getYFunction(p1), getYFunction(p2))};
            box.edge = buildEdge(faces, vertices, i, j, (j + 1) % 3);

            // search if this edge already exists
            var eBox = SVG3DScene.getOppositeBox(box, bbox, isOppositeBox);

            if (eBox) { // if it exists we remove it (it is an inner edge)
                bbox.remove(eBox);
            }
            else { // otherwise we add it
                bbox.insert(box);
            }
        }
    }
            
    return bbox;
}


