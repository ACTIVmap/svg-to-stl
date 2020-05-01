# SVG to STL Converter

Created to create tactile maps for visually impaired people from a simple image, this tool runs entirely in the local browser. As the name implies, it takes a [scalable vector graphics] \(SVG\) file as input, and produces an ASCII [stereo-lithography] \(STL\) file as output.

This tool is part of the tools created by the [ACTIVmap](https://activmap.limos.fr) project.

### Demo
You can try the tool [online](https://jmtrivial.github.io/svg-to-stl/).

There are example SVG files in [example-svg/](https://github.com/jmtrivial/svg-to-stl/tree/master/example-svg/).

### Screenshot
 ![Screenshot](https://raw.githubusercontent.com/jmtrivial/svg-to-stl/master/screenshot.png)

### Options
  - Specifying type height for each color (possibly negative)
  - Rendering with and without a base plate
    - Round, Square and Rectangular base plates supported
    - Specifying base plate height (bypassing the size defined in the SVG)
  - Optionally tune some parameters to bypass some limitations of the reconstruction algorithms

### Known problems
  - SVG mask are not supported. Unfortunally, Adobe Illustrator may produce SVG with such elements. If you are used to design using masks, please remove them from you files before importing it in SVG-to-STL (for example using *Expand* then *Crop button* from the *Pathfinder* panel). 
  - First implementation of the strokes (border of the shapes) is not perfect.
  - SVG text elements are not supported. To render text, you need to convert the text to "outlines" or "paths" before saving the SVG file.
  - Some configurations may produce non closed meshes (exemple-07.svg file). This problem is due to serveral bugs in Martinez, that will be corrected in a near future (I hope).

### Requirements
This tool requires javascript support, and a browser that can handle a [WebGL] canvas, and the [File API].

### Version
0.6b

### Tools Used
svg-to-stl makes use of a number of other open source projects:

* [three.js] - For WebGL rendering of a 3D scene
* [d3-threeD] - For converting SVG paths into three.js geometries
* [martinez] - For clipping shapes preserving only visible parts
* [Clipper.js] - For stroke drawing
* [rbush] - For efficient intersections and proximity detections
* [flatten.js] - For applying all heirarchical transforms in an SVG to its paths
* [ThreeCSG] - For [Constructive Solid Geometry] support
* [STLExporter] - For converting a three.js geometry into an ASCII STL file
* [Bootstrap] - For User Interface
* [bootstrap-colorpicker] - For color selection
* [bootstrap-dark] - A dark theme
* [Entypo] - Example SVG files to play with
* [jQuery]


   [printing press]: <https://en.wikipedia.org/wiki/Printing_press>
   [scalable vector graphics]: <https://en.wikipedia.org/wiki/Scalable_Vector_Graphics>
   [stereo-lithography]: <https://en.wikipedia.org/wiki/STL_(file_format)>
   [hosted directly from github]: <https://rawgit.com/ryancalme/svg-to-stl/master/SVGtoSTL.html>
   [example-svg/Entypo]: </example-svg/Entypo>
   [WebGL]: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API>
   [File API]: <http://www.w3.org/TR/FileAPI/>
   [Constructive Solid Geometry]: <https://en.wikipedia.org/wiki/Constructive_solid_geometry>
   [three.js]: <https://github.com/mrdoob/three.js>
   [d3-threeD]: <https://github.com/asutherland/d3-threeD>
   [flatten.js]: <https://github.com/jmtrivial/flatten.js>
   [ThreeCSG]: <https://github.com/chandlerprall/ThreeCSG>
   [STLExporter]: <https://gist.github.com/kjlubick/fb6ba9c51df63ba0951f>
   [Spectrum]: <https://github.com/bgrins/spectrum>
   [Entypo]: <http://www.entypo.com>
   [jQuery]: <https://jquery.com/>
   [martinez]: <https://github.com/w8r/martinez/>
   [Bootstrap]: <https://getbootstrap.com/>
   [bootstrap-colorpicker]: <https://github.com/itsjavi/bootstrap-colorpicker>
   [bootstrap-dark]: <https://github.com/ForEvolve/bootstrap-dark>
   [rbush]: <https://github.com/mourner/rbush>
   [Clipper.js]: <https://sourceforge.net/projects/jsclipper/>
   
