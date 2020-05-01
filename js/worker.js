importScripts('external/tXml.js', 
                'SVGtoSTL.js',
                'svg-crop.js', 
                "external/d3-threeD.js", 
                "external/three.js", 
                "external/rbush.min.js", 
                "external/martinez.min.js", 
                "box.js",
                "external/clipper.js");

var options = null;

var svgStructure = null;

var colorDepths = null;

var initialMaxDepth = 3;

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}



function getSVGColor(color) {
    color = color.toLowerCase();
    if (color in colorDepths) {
        return colorDepths[color];
    }
    else {
        rgb = hexToRgb(color);
        val = (3 - (rgb.r + rgb.g + rgb.b) / 256 / 3 * initialMaxDepth).toFixed(2);
        colorDepths[color] = val;
        return val;
    }
}
function setSVGColors(svgColors) {
    tableLines = "";
    
    // sort the list and remove multiple instances
    list = svgColors.filter((x, i, a) => a.indexOf(x) == i).sort();
    for(i = 0; i < list.length; i++) {
        if (list[i] != "") {
            value = getSVGColor(list[i]);
            tableLines += "<tr id=\"lineDepth" + i + "\">" + 
                            "<th scope=\"row\" style=\"vertical-align: middle\">" + i + "</th>" +
                            "<td style=\"vertical-align: middle\"><span style=\"background: " + list[i] + "; cursor: auto" +
                            (value > 1.5 ? "; color: #ffffff" : "; color: #000000") +
                            "\" class=\"btn btn-block\">" + list[i] + "</span></td>" +
                            "<td><input type=\"number\" class=\"form-control\" id=\"typeDepth" + i + "\" value=\"" +
                            value + "\"></td>" +
                            "</tr>";
        }
    }
    
    postMessage(["SVGColors", tableLines]);

}


function processNewSVG(svg, opt, viewBox, cdepths) {

    options = opt;
    colorDepths = cdepths;
    
    // load the svg structure
    // TODO: do we need this reverseWO?
    try {
        svgStructure = new SVGCrop(svg, options, viewBox);

        // set SVG colors in the UI and in the storage
        setSVGColors(svgStructure.getPalette());

        // ask main thread to run the next steps (reloading options)
        postMessage(["runMeshProcessing"]);
    }
    catch (e) {
        postMessage(["error", e.toString()]);
    }

}

function processSVG2Mesh(opt, cdepths) {
    options = opt;
    colorDepths = cdepths;

    if (svgStructure.getNbShapes() == 0) {
        postMessage(["noshapefound"]);
        return;
    }
    else if (svgStructure.getNbShapes() == 1)
        postMessage(["onshapefound"]);
    else
        postMessage(["shapesfound", svgStructure.getNbShapes()]);

    // Create an extrusion from the SVG path shapes
    try {
        var finalObj = getExtrudedSvgObject(svgStructure, options);

        // send back mesh
        postMessage(["mesh", finalObj["vertices"], finalObj["faces"]]);
    }
    catch (e) {
        postMessage(["error", e.toString()]);
    }
}


onmessage = function (e) {
    if (e.data[0] == "fullProcessSVG")
        processNewSVG(e.data[1], e.data[2], e.data[3], e.data[4]);
    else if (e.data[0] == "fullProcessMesh") {
        processSVG2Mesh(e.data[1], e.data[2]);
    }
    else {
        console.log("Unknown message received from main script: " + e.data);
    }
};
