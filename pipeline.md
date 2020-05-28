# Pipeline

Starting from an SVG file that describes a 2D drawing, [SVG-to-STL](README.md) produces a ready to 3D print STL file. 

The first steps of the pipeline are done directly using the [DOM description](https://www.w3.org/TR/SVG11/svgdom.html) of the SVG. The data is then translated in an internal format that handle 2D geometry (made of polylines and polygons structured into shapes). To avoid interface freezing, a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) has been implemented to compute all the geometrical steps in a separated thread. Messages are sent back to the UI thread to give feedback to the user.

Here are the main stages of the processing. 

## SVG cleaning

After loading the SVG file into the html page, the following steps are applied to the DOM description:

* get some information about the desired final size (in mm)
* remove redundant elements of the SVG file (some 2D softwares or libraries are producing SVG with duplicated shapes). Function `removeTwins`.
* use [flatten.js](https://github.com/jmtrivial/flatten.js) to apply all the [transformations](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform) (rotations, translations, ...) embedded in the SVG file. This step implies to duplicate masks and clip-paths if they are applied to more than one element.
* remove again possibly redundant elements (in case the flattening modified elements such that they are equivalent)

## 2D geometry processing

Starting from this point, the processing is done in a worker, since it do not modify the DOM description. Convertion from the DOM description into an internal data structure (`SVGGroup2D`) is done in `SVGCrop` class.

The first step is to build a `SVGGroup2D` instance from the SVG. This class is a hierarchical structure, each element can be or a group of `SVGGroup2D`, or a shape. A shape is described by a contour (2D polygon) and a list of holes (2D polygons). We can associate to each element of this structure a clip path or a mask also described as an `SVGGroup2D`. A color is also associated to each element, and the ordering from SVG is preserved between elements to handle occlusions.

This first step is processed hierarchically as following: 

* each group is a `SVGGroup2D`
* each path is turned into a series of `SVGGroup2D` as following:
    * we transform it into shapes using d3 library
    * we split all these shapes into elementary shapes (contour + holes)
    * if the shape has a stroke (with its own color), this stroke is converted as a supplementary shape (using [Clipper](https://sourceforge.net/projects/jsclipper/)).
* if a mask or a clip path is applied to this SVG element, we convert it using the same approach.

The next step is to apply clipping (and masks in a future implementation). The boolean operations are processed using [Martinez](https://github.com/w8r/martinez).

At this stage, we add a base (corresponding to the background of the SVG image) if the user asked for it.

The next step consists in clipping shapes using visibility. Starting from the upper shape, we integrate the next shapes from top to bottom. On one side, we use an **union operator** to obtain the global silhouette of the shape. On the other side, we remove from each shape the silhouette of the upper elements (**difference operator**). It may produce more than one shape after clipping. Along all this processing, we preserve shapes' color.

The next step consists in rescaling and centering the object according to the desired size.

The next steps will require adjacent shapes to have points at the same location. It may append that some points are missing. At this step, we browse all the shapes, consider its neighbors, and consider adding elements in the contour and holes if required.

**Remark:** to speed-up computation (union and difference operators, add missing points), [an optimized data structure](https://github.com/mourner/rbush) has been used to consider only shapes that may intersect the one we are processing.

At the end of this processing, a list of the identified colors is return back to the UI thread to update the interface, such that the user will be able to tune the depths associated to each color. The UI thread handle this message, update the UI, then run the 3D reconstruction using a message to the worker dedicated to the geometry.

## 3D reconstruction

The 3D reconstruction is done from a list of 2D shapes (as described before, a shape is a contour and a list of holes) using [three.js](https://threejs.org/).

This processing is done in the `SVG3DScene` class, using the color of each shape together with a lookup table defined by the user (to each color the user associates the desired depth) to adjust its z position.

The first step consists in merging shapes at the same depth using a **union operator**. This process is merging shapes that are adjacent and at the same depth.

Then we create the 3D shape as following:

* create a 3D flat shape for each 2D shape using the z coordinate given by its color. This operation is made by triangulating the initial contour+holes shapes.
* create a 3D flat shape for each 2D shape contained in the global silhouette of the drawing, using a z coordinate defined by the desired thickness of the board. This operation is made by triangulating the initial contour+holes shapes.
* add side facets as following:
    * get a list of all the boundary edges (edges that are only in a single triangle)
    * for each edge, find the edges with same (x,y) coordinate in at least one vertex
    * add all required triangles to fill the sides (considering complicated configurations in case of multiple depth shapes at the same 2D location)


