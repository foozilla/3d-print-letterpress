"use strict";

var fs = require('fs');
var opentype = require("opentype.js");
var JSM = require("../lib/jsmodeler.js");
var segmentElem = require("../lib/segmentelem.js");
var ContourPolygonToPrisms = require("../lib/contourpolygontoprisms.js");

var args = process.argv.slice(2);
var file = args[0];
var pointsize = args[1] ? args[1] : 72;
var ch = args[2] ? args[2] : 'A';


opentype.load(file, function (err, font) {
    if (err) {
        console.error("File '" + args[0] + "' not found, exiting.");
        return;
    }

    var glyphs = font.stringToGlyphs(ch);

    var capTopZ = 
        getModelForGlyph(font.charToGlyph('H'))
        .GetBody(0).GetBoundingBox().max.z;

    for (var a = 0, b = glyphs.length; a < b; a++) {
        var model = getModelForGlyph(glyphs[a]);

        var bboxdims = model.GetBody(0).GetBoundingBox();
        for (var n = 1, bodies = model.BodyCount(); n < bodies; n++) {
            var bbox = model.GetBody(n).GetBoundingBox();
            bboxdims.max.x = Math.max(bboxdims.max.x, bbox.max.x);
            bboxdims.max.y = Math.max(bboxdims.max.y, bbox.max.y);
            bboxdims.max.z = Math.max(bboxdims.max.z, bbox.max.z);

            bboxdims.min.x = Math.min(bboxdims.min.x, bbox.min.x);
            bboxdims.min.y = Math.min(bboxdims.min.y, bbox.min.y);
            bboxdims.min.z = Math.min(bboxdims.min.z, bbox.min.z);
        }
        
        var bboxWidthX = bboxdims.max.x - bboxdims.min.x;

        var typeHigh = 0.918 * 72;
        var faceHeight = 2;
        var base = JSM.GenerateCuboid(bboxWidthX, typeHigh - faceHeight, pointsize);

        var nick = JSM.GenerateCylinder(5, bboxWidthX);
        base = JSM.BooleanOperation ('Difference', base, nick);

        var alignBaseToLetter = JSM.TranslationTransformation (
            new JSM.Coord (
                bboxdims.min.x + bboxWidthX / 2,
                bboxdims.max.y - (typeHigh / 2) - (faceHeight / 2),
                capTopZ - pointsize / 2
            ));
        base.Transform (alignBaseToLetter);
        model.AddBody(base);

        var stl = JSM.ExportModelToStl(model);

        var name = glyphs[a].name;
        fs.mkdir("../out/", function () { 

            var faceName = file;
            if (faceName.indexOf("/") != -1)
                faceName = faceName.substring(faceName.lastIndexOf("/") + 1);
            if (faceName.indexOf(".") != -1)
                faceName = faceName.substring(0, faceName.indexOf("."));

            var filename = faceName + name + pointsize + "pt.stl";

            fs.writeFile("../out/" + filename, stl, function(err) {
                if(err) {
                    console.log(err);
                } else {

                    console.log("output written to out/" + filename);
                }
            }); 
        });
    }
});

function getModelForGlyph(glyph) {
    var commands = glyph.getPath(0, 0, pointsize).commands;

    var model = new JSM.Model ();
    var polygons = segmentElem(commands, 1);

    var currentHeight = 10;
    
    var i, j, prismsAndMaterial, currentPrisms, currentPrism, currentMaterial;
    for (i = 0, len = polygons.length; i < len; i++) {
        prismsAndMaterial = ContourPolygonToPrisms (polygons[i], currentHeight);
        currentPrisms = prismsAndMaterial[0];
        for (j = 0; j < currentPrisms.length; j++) {
            currentPrism = currentPrisms[j];
            model.AddBody (currentPrism);
        }
    }

    return model;
} 