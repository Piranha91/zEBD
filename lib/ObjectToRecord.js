module.exports = function(logDir, fh, xelib)
{
    let deserializer = {};

    deserializer.deserializeMatorJSONobjects = function(objects, patchFile)
    {
        let dictionary = {};
        let allEDIDs = [];

        let basePath = "";
        let currentRecordHandle;
        let recordHandles = [];
        let signature = "";
        let EDID = "";
        let formID = "";


        // first make new elements corresponding to each object, and store their EDIDS and FormIDs
        for (let i = 0; i < objects.length; i++)
        {
            signature = objects[i]["Record Header"].Signature;

            basePath = signature + "\\" + signature;
            currentRecordHandle = xelib.AddElement(patchFile, basePath);
            recordHandles.push(currentRecordHandle); // recordHandle[i] corresponds to objects[i]

            EDID = objects[i]["EDID - Editor ID"];
            formID = xelib.GetHexFormID(currentRecordHandle);

            dictionary[EDID] = formID;

            allEDIDs.push(EDID);
        }

        // then assign values to the record

        for (let i = 0; i < objects.length; i++)
        {
            assignValuesToRecord(objects[i], recordHandles[i], xelib, "", dictionary, false, allEDIDs[i]);
        }

        return dictionary;
    }

    return deserializer;
};



function assignValuesToRecord(recordTemplate, recordHandle, xelib, prependPath, dictionary, bKeepOriginalFormID, currentEDID)
{
    let prependPathOrig = prependPath;
    let tmpHandle;

    for (let [element, value] of Object.entries(recordTemplate)) // iterate through each element of the record
    {
        if (element === "KSIZ - Keyword Count") { continue; } // don't set keyword count - xelib does this automatically

        if (isObject(value) === true) // if the value is an object (including array) | Note that an array of flags will also be an object, so handle flags here
        {
            tmpHandle = xelib.AddElement(recordHandle, prependPath + element); // required to call IsFlags
            if (xelib.IsFlags(tmpHandle) === true) // if element points to flag
            {
                for (let [flag, flagValue] of Object.entries(value))
                {
                    xelib.SetFlag(recordHandle, prependPath + element, flag, flagValue);
                }
            }

            else if (Array.isArray(value) === true) // if the element value is an array
            {
                if (element === "Scripts")
                {
                    parseScripts(recordHandle, prependPath + element, value, xelib, dictionary);
                }

                else
                {
                    for (let i = 0; i < value.length; i++) // iterate through each array element
                    {
                        if (isObject(value) === false)
                        {
                            xelib.AddArrayItem(recordHandle, prependPath + element, "", value[i]);  // CHECK THIS
                        }
                        else
                        {
                            //xelib.AddElement(prependPath + element + "\\.");
                            assignValuesToRecord(value[i], recordHandle, xelib, prependPath + element + "\\[" + i.toString() + "]\\", dictionary, bKeepOriginalFormID, currentEDID);
                        }

                    }
                }
            }

            else // if the element is an object but not an array, prepend the element's path and recurse function to that element's value.
            {
                prependPath += element + "\\";
                assignValuesToRecord(value, recordHandle, xelib, prependPath, dictionary, bKeepOriginalFormID, currentEDID); // recursion here
                prependPath = prependPathOrig; // revert prependPath back to what it was in this
            }
        }

        else // if the element is not another object, set its value to that defined in the JSON file
        {
            if (!(typeof value === 'string' || value instanceof String)) { value = value.toString(); } // convert numbers to strings

            // check here if the value is a referenced EDID (NOT THE record's EDID)
            if (element != "EDID - Editor ID" && dictionary[value] != undefined)
            {
                value = dictionary[value]; // convert value to its formID
            }

            if (element === "FormID")
            {
                return; // can't figure out yet how to change this object's formID. Not really important to my project so ignoring.
            }

            if (value != undefined)
            {
                xelib.AddElementValue(recordHandle, prependPath + element, value);
            }
            else
            {
                xelib.AddElement(recordHandle, prependPath + element);
            }
        }
    }
}

function parseScripts(recordHandle, path, scriptsArray, xelib, dictionary)
{
    let scriptHandle;
    let scriptPropertyHandle;

    let scriptName = "";
    let scriptFlags = ""; // I think flags can either be "edited" or "local" but need to confirm. Either way xelib.AddScript expects a string value for this.

    let scriptPropertyName = "";
    let scriptPropertyType = "";
    let scriptPropertyFlags = "";

    let scriptPropertyFormID = "";
    let scriptPropertyAlias = "";

    for (let i = 0; i < scriptsArray.length; i++)
    {
        scriptName = scriptsArray[i].scriptName;
        scriptFlags = scriptsArray[i].Flags.toString();

        scriptHandle = xelib.AddScript(recordHandle, scriptName, scriptFlags);

        if (scriptsArray[i].Properties != undefined)
        {
            for (let j = 0; j < scriptsArray[i].Properties.length; j++)
            {
                scriptPropertyName = scriptsArray[i].Properties[j].propertyName;
                scriptPropertyType = scriptsArray[i].Properties[j].Type.toString();
                scriptPropertyFlags = scriptsArray[i].Properties[j].Flags.toString();

                scriptPropertyHandle = xelib.AddScriptProperty(scriptHandle, scriptPropertyName, scriptPropertyType, scriptPropertyFlags);

                scriptPropertyFormID = scriptsArray[i].Properties[j].Value["Object Union"]["Object v2"].FormID;

                if (dictionary[scriptPropertyFormID] != undefined)
                {
                    scriptPropertyFormID = dictionary[scriptPropertyFormID];
                }

                scriptPropertyAlias = scriptsArray[i].Properties[j].Value["Object Union"]["Object v2"].Alias.toString();

                xelib.AddElementValue(scriptPropertyHandle, "Value\\Object Union\\Object v2\\FormID", scriptPropertyFormID);
                xelib.AddElementValue(scriptPropertyHandle, "Value\\Object Union\\Object v2\\Alias", scriptPropertyAlias);
            }
        }

    }
}

function isObject(val) {
    if (val === null) { return false;}
    return (typeof val === 'object');
}