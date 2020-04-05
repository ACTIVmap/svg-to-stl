


class SVGCrop {

    constructor(svgID) {
        this.svgNode = document.getElementById('uploadedSVG');

    }
    
    applyMasksAndClips() {
        // TODO
    }
    
    
    getPaths() {
        // TODO: add support of clip-path and masks
        this.paths = $("path", this.svgNode).map(function(){return $(this).attr("d");}).get();
        return this.paths;

    }
    
    getColors() {
        // TODO: add support of clip-paths and masks
        return $("path", this.svgNode).map(
                function(){ 
                    var regex = /([\w-]*)\s*:\s*([^;]*)/g;
                    var match, properties={};
                    while(match=regex.exec($(this).attr("style"))) properties[match[1].trim()] = match[2].trim();
                    return "fill" in properties ? properties["fill"] : "#000000";
                }
          ).get();
    }
    

};
