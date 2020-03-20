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
    var svgMesh = getExtrudedSvgObject( paths, viewBox, svgColors, options);

    // Will hold the joined geometry
    var finalObj;

    // If we wanted a base plate, let's create that now
    if(options.wantBasePlate) {
        // Shift the SVG portion away from the bed to account for the base
        var translateTransform = new THREE.Matrix4().makeTranslation( 0, 0, options.baseDepth );
        svgMesh.geometry.applyMatrix4( translateTransform );

        // Create Base plate mesh
        var basePlateMesh = getBasePlateObject( options, svgMesh, viewBox );

        // For constructive solid geometry (CSG) actions
        baseCSG = THREE.CSG.fromMesh( basePlateMesh );
        svgCSG  = THREE.CSG.fromMesh( svgMesh );

        // If we haven't inverted the type, the SVG is "inside-out"
        if(!options.wantInvertedType) {
            svgCSG = svgCSG.invert();
        }

        // TODO: reintroduce negative typeDepths
        // Positive typeDepth means raised
        // Negative typeDepth means sunken 
        /*finalObj = THREE.CSG.toMesh((options.typeDepth > 0) ? svgCSG.union(baseCSG) : baseCSG.intersect(svgCSG),
            options.material);*/
        finalObj = THREE.CSG.toMesh(svgCSG.union(baseCSG), options.material);
        
        // remove double points
        finalObj.geometry.mergeVertices();
        
        // TODO: correct here the topology of the mesh
        // https://github.com/mrdoob/three.js/blob/master/src/geometries/ExtrudeGeometry.js
        // var vertices = shapePoints.shape;
        // var holes = shapePoints.holes; puis clockwise,
        // puis on créé les triangles (on le fait pour chaque shape
        // var faces = ShapeUtils.triangulateShape( vertices, holes );
        // puis on merge les vertices
        // https://threejs.org/docs/#api/en/core/Geometry.mergeVertices
        // attention, ça supprime les faces. Peut-on ajouter aux objets face leur information d'altitude, pour ne pas perdre l'information ?
        // au pire, on utilise le material index

                        
    }
    // Didn't want a base plate
    else {
        finalObj = svgMesh;
    }

    // Add the merged geometry to the scene
    group.add( finalObj );
    
    // change zoom wrt the size of the mesh
    camera.position.set( 0, -options.objectWidth, options.objectWidth);

    // Show the wireframe?
    if(options.wantWireFrame) {
        var wireframe = new THREE.WireframeGeometry( finalObj.geometry );
        var lines = new THREE.LineSegments( wireframe );
        lines.material.depthTest = false;
        lines.material.opacity = 0.25;
        lines.material.transparent = true;
        group.add(lines);
    }
    // Show normals?
    if(options.wantNormals) {
        var normals = new THREE.FaceNormalsHelper( finalObj, 2, 0x000000, 1 );
        group.add( normals );
    }
    // Show hard edges?
    if(options.wantEdges) {
        // TODO: three.js: THREE.EdgesHelper has been removed. Use THREE.EdgesGeometry instead.
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

// Creates a three.js Mesh object for a base plate
function getBasePlateObject( options, svgMesh, viewBox ) {
    var basePlateMesh;
    
    if (options.ignoreDocumentMargins) {
        // Determine the finished size of the extruded SVG with potential bevel
        var svgBoundBox = svgMesh.geometry.boundingBox;
        width  = (svgBoundBox.max.x - svgBoundBox.min.x);
        height = (svgBoundBox.max.y - svgBoundBox.min.y);
    }
    else {
        width = options.objectWidth;
        height = width * (viewBox[3] - viewBox[1]) / (viewBox[2] - viewBox[0]);
    }
    var maxBbExtent = (width>height) ? width : height;
    
    // If we asked for a rectangle
    if(options.basePlateShape==="Rectangular") {
        if (options.squareBase) {
            // Now make the square base plate
            var basePlate = new THREE.BoxGeometry(
                maxBbExtent+options.baseBuffer,
                maxBbExtent+options.baseBuffer,
                options.baseDepth );
        }
        else {
            var basePlate = new THREE.BoxGeometry(
                width+options.baseBuffer,
                height+options.baseBuffer,
                options.baseDepth );
        }
        basePlateMesh = new THREE.Mesh(basePlate, options.material);
    }
    // Otherwise a circle
    else {
        if (options.ignoreDocumentMargins) {
            // Find SVG bounding radius
            radius = svgMesh.geometry.boundingSphere.radius;
        }
        else {
            radius = Math.sqrt(Math.pow((maxBbExtent/2),  2) + Math.pow((maxBbExtent/2), 2)) + options.baseBuffer;
        }
        var basePlate = new THREE.CylinderGeometry(
            radius + options.baseBuffer,
            radius + options.baseBuffer,
            options.baseDepth,
            64 );	// Number of faces around the cylinder
        basePlateMesh = new THREE.Mesh(basePlate, options.material);
        var rotateTransform = new THREE.Matrix4().makeRotationX( Math.PI/2 );
        basePlateMesh.geometry.applyMatrix4( rotateTransform );
    }
    // By default, base is straddling Z-axis, put it flat on the print surface.
    var translateTransform = new THREE.Matrix4().makeTranslation( 0, 0, options.baseDepth/2 );
    basePlateMesh.geometry.applyMatrix4( translateTransform );
    return basePlateMesh;
}


function THREEShapesToClipperPaths (shapes) {
    var points = [];
    for (var j = 0, l = shapes.length; j < l; j++) {
        var tpoints = shapes[j].extractPoints().shape;
        var cpoints = [];
        for(p = 0; p != tpoints.length; p++) {
            cpoints.push(new ClipperLib.IntPoint(tpoints[p].x, tpoints[p].y));
        }
        points.push(cpoints);
        
    }
    return points;
}

function ClipperPathsToTHREEShapes(shapes) {
    var points = [];
    
    for (var j = 0, l = shapes.length; j < l; j++) {
        var cpoints = [];
        for(p = 0; p != shapes[j].length; p++) {
            cpoints.push(new THREE.Vector2(shapes[j][p].X, shapes[j][p].Y));
        }
        // close the shape by adding the first point as last one
        cpoints.push(new THREE.Vector2(shapes[j][0].X, shapes[j][0].Y));
        
        points.push(new THREE.Shape(cpoints));
    }
    
    return points;
}

// Creates a three.js Mesh object out of SVG paths
function getExtrudedSvgObject( paths, viewBox, svgColors, options ) {
    
    // first use inverse order to crop shapes according to their visibility
    var shapes = [];
    var upperShape = null;
    if (paths.length > 0) { 
        for (var i = paths.length - 1; i >= 0; i--) {
            // Turn each SVG path into a three.js shape
            var path = d3.transformSVGPath( paths[i] );

            // discretize the path and convert it to clipper format
            var newShapes = path.toShapes(options.svgWindingIsCW);
            points = THREEShapesToClipperPaths(newShapes);
            
            // if it's the first shape, add it to the upper part
            if (shapes.length == 0) {
                upperShape = points;
                shapes.push(newShapes);
            }
            else {
                // convert the path to clipper format
                var cpr = new ClipperLib.Clipper();
                cpr.AddPaths(points, ClipperLib.PolyType.ptSubject, true);
                
                cpr.AddPaths(upperShape, ClipperLib.PolyType.ptClip, true);
                
                // compute the visible part of this shape
                difference = new ClipperLib.Paths();
                cpr.Execute(ClipperLib.ClipType.ctDifference, difference, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

                // convert it back to THREE format and add it to the final data structure
                shapes.unshift(ClipperPathsToTHREEShapes(difference));
                
                // compute the new upper part
                cpr.Execute(ClipperLib.ClipType.ctUnion, upperShape, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
            }
            
        }
        
    }
    
    extruded = new THREE.Geometry();
    for(i = 0; i != shapes.length; i++) {
        // extrude the shape wrt its depth
        var extrudedShape = new THREE.ExtrudeGeometry( shapes[i], {
            depth: options.typeDepths[svgColors[i]],
            bevelEnabled: false
        });
        
        // add the extruded shape in the final geometry
        extruded.merge(extrudedShape); 
    }
    
    
    
    // TODO: reintroduce negative typeDepths
    // Negative typeDepths are ok, but can't be deeper than the base
    /*if(options.wantBasePlate &&
        options.typeDepth < 0 &&
        Math.abs(options.typeDepth) > options.baseDepth) {
        options.typeDepth = -1 * options.baseDepth;
    }*/
    
    // Find the bounding box of this extrusion
    extruded.computeBoundingBox();
    
    var boundBox;
    if (options.ignoreDocumentMargins) {
        boundBox = extruded.boundingBox;
    }
    else {
        boundBox = new THREE.Box2(new THREE.Vector2(viewBox[0], viewBox[1]),
                                  new THREE.Vector2(viewBox[2], viewBox[3]));
    }
    var svgWidth  = (boundBox.max.x - boundBox.min.x);
    var svgHeight = (boundBox.max.y - boundBox.min.y);

        
    // Center on X/Y origin
    var translateTransform = new THREE.Matrix4().makeTranslation(
        // Half its width left
        -(Math.abs((boundBox.max.x-boundBox.min.x)/2)+boundBox.min.x),
        // Half its height downward
        -(Math.abs((boundBox.max.y-boundBox.min.y)/2)+boundBox.min.y),
        // Don't mess with the depth 
        0 );
    extruded.applyMatrix4( translateTransform );
    
    // Scale to requested size (lock aspect ratio)
    var scaleTransform = new THREE.Matrix4().makeScale(
        (options.objectWidth  / svgWidth),  // locking aspect ratio by scaling
        (options.objectWidth  / svgWidth),  // the largest dimension to that requested
        1 );                               // Keep the depth as-is
    extruded.applyMatrix4( scaleTransform );


    // Use negative scaling to invert the image
    // flip the image to change from SVG orientation to Three.js orientation
    if(!options.wantInvertedType) {
        var invertTransform = new THREE.Matrix4().makeScale( -1, 1, 1 );
        extruded.applyMatrix4( invertTransform );
    }
      
    // Rotate 180 deg
    // Different coordinate systems for SVG and three.js
    var rotateTransform = new THREE.Matrix4().makeRotationZ( Math.PI );
    extruded.applyMatrix4( rotateTransform );
    
    // Into a mesh of triangles
    var mesh = new THREE.Mesh(extruded, options.material);
    

    // So that these attributes of the mesh are populated for later
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    return mesh;
};

