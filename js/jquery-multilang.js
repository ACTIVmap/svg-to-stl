/*
 * 
 * Derivated from jquery-multilang, from Davide Gessa, gessadavide@gmail.com
 * Original license: MIT License
 * https://github.com/dakk/jquery-multilang/
 * 
 */




window.langs = ['fr'];
window.langCode = '';

window.contents = [];

var translate = function (lang) {

    $("[tkey]").each (function (index) {
        var strTr = window.contents[lang][$(this).attr ('tkey')];
        $(this).html(strTr);});
    $("[tkeyvalue]").each (function (index) {
        var strTr = window.contents[lang][$(this).attr ('tkeyvalue')];
        $(this).attr("value", strTr); });
    
}
var translation = function(key, enVersion) {
    var lang = window.langCode;

    if ((lang == "en") || (window.langs.indexOf(window.langCode) == -1)) {
        return enVersion;
    }
    else
        return window.contents[lang][key];
}

// load from files
var load = function(jsdata) {
    var lang = jsdata[":lang"];
    window.contents[lang] = jsdata;
}

var setLang = function() {
    
    if (window.langs.indexOf(window.langCode) != -1) {
        translate(window.langCode);
        $("#langItems .dropdown-item").removeClass("active");
        $("#langItems #item-" + window.langCode).addClass("active");
        $("html").attr("lang", window.langCode);
    }
};



$(document).ready( function () {
    // load english version from the html
    window.contents["en"] = [];

    $("[tkey]").each (function (index) {
        window.contents["en"][$(this).attr ('tkey')] = $(this).html();
    });
    $("[tkeyvalue]").each (function (index) {
        window.contents["en"][$(this).attr ('tkeyvalue')] = $(this).attr("value");
    });
    
    // get language from the browser
    window.langCode = navigator.language.substr(0, 2);

    // load translations, and translate if it matches
    for(i = 0; i != window.langs.length; ++i) {
        $.getJSON('lang/' + window.langs[i] + '.json', load).done(function() { setLang(); });
    }

    window.langs.push("en");
});



