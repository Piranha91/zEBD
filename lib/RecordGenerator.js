// Note: In this js file, the terminology "record" and "recordTemplate" is used somewhat interchangeably
// Record templates are found in zEBD assets\RecordTemplates. They contain the information that will be written to records in the patch file
// Since the patcher hasn't run yet and therefore no new records have yet been generated, any time this code refers to a "record", it means "recordTemplate."

let Aux = require('./Auxilliary.js');
module.exports = function(logDir, fh)
{
    let RG = {};
    RG.recordTemplates = []; 

    RG.getMaxRecordDepth = function(recordTemplates)
    {
        let maxPriority = 0;
        let tmpMaxPriority = 0;
        for (let i = 0; i < recordTemplates.length; i++)
        {
            tmpMaxPriority = setRecordTemplatePriorities(recordTemplates[i], 0, 0);
            if (tmpMaxPriority > maxPriority)
            {
                maxPriority = tmpMaxPriority;
            }
        }
    
        return maxPriority;
    }

    RG.initializeExcludedExtensions = function(settings)
    {
        let excludedExtensions = [];
        if (settings.changeTextures === false) { excludedExtensions.push("dds");}
        if (settings.changeMeshes === false) { excludedExtensions.push("nif");}
        return excludedExtensions;
    }

    RG.generatePathMapByPathType = function(assetPackSettings, recordTemplates, excludedExtensions)
    {
        // get list of all paths in all subgroups
        let paths = [];
        let tmpPaths = [];
        let flatTemplateList = [];

        for (let i = 0; i < assetPackSettings.length; i++)
        {
            for (let j = 0; j < assetPackSettings[i].subgroups.length; j++)
            {
                tmpPaths = [];
                Aux.getAllValuesInObject(assetPackSettings[i].subgroups[j], tmpPaths, "paths");
                for (let k = 0; k < tmpPaths.length; k++) // tmpPaths comes back as an array of arrays of paths. Awkward but manageable
                {
                    if (tmpPaths[k].length > 0)
                    {
                        for (let l = 0; l < tmpPaths[k].length; l++)
                        {
                            if (checkFileTypeAllowed(tmpPaths[k][l][1], excludedExtensions) === true)
                            {
                                paths.push(tmpPaths[k][l][1]) // 0 is the path to be assigned, 1 is the path in the record template
                            }
                        }
                    }
                }
            }
        }

        paths = Aux.getArrayUniques(paths);

        //flatten the nested recordTemplates into a 1D array
        for (let i = 0; i < recordTemplates.length; i++)
        {
            Aux.flattenZEBDSubRecords(recordTemplates[i], flatTemplateList);
        }

        let tmpPathStorageObj = {};
        let pathMapping = {};
        for (let i = 0; i < paths.length; i++)
        {
            pathMapping[paths[i]] = {};
            for (let j = 0; j < flatTemplateList.length; j++)
            {
                tmpPathStorageObj = {"zEBDUniqueID": flatTemplateList[j].zEBDUniqueID};
                getGlobalPathFromObjectTemplate(paths[i], flatTemplateList[j], tmpPathStorageObj, "");
                if (tmpPathStorageObj.totalPath !== undefined)
                {
                    //make a category for this subrecord type if it doesn't exist
                    if (pathMapping[paths[i]][flatTemplateList[j].zEBDUniqueID] === undefined)
                    {
                        pathMapping[paths[i]][flatTemplateList[j].zEBDUniqueID] = [];
                    }

                    pathMapping[paths[i]][flatTemplateList[j].zEBDUniqueID].push(tmpPathStorageObj.totalPath.substring(1)); // substring to cut off leading '\'
                }
            }
        }

        return pathMapping;
    }

    RG.updatePermutationWithRecords = function(NPCinfo, permutation, uniqueRecordList, recordTemplates, settings, pathMapByPathType, trimPaths, logMessage)
    {
        let usedRTUniqueIDs = []; // for figuring out which recordTemplates were actually used
        let bCurrentPathAssigned = false;
        let newTemplate = {};
        let generatedRecordList = [];

        // alias NPC as needed
        Aux.setAliasRace(NPCinfo, settings.raceAliasesSorted, "assets");

        permutation.templates = [];

        trimPermutationPaths(permutation, trimPaths, fh);
    
        for (let i = 0; i < recordTemplates.length; i++)
        {
            if (recordTemplates[i].zEBDsupportedRaces.includes(NPCinfo.race) && recordTemplates[i].zEBDgender === NPCinfo.gender)
            {
                newTemplate = angular.copy(recordTemplates[i]);
                newTemplate.zEBDpathSignature = "";
                permutation.templates.push(newTemplate);
            }
        }
    
        for (let i = 0; i < permutation.paths.length; i++)
        {
            bCurrentPathAssigned = false;
            for (let j = 0; j < permutation.templates.length; j++)
            {
                if (assignRecordPathByMap(permutation.templates[j], pathMapByPathType, permutation.paths[i]) === true) // returns true if templates[j] was the correct record type
                {
                    bCurrentPathAssigned = true;
                    if (usedRTUniqueIDs.includes(permutation.templates[j].zEBDUniqueID) === false)
                    {
                        usedRTUniqueIDs.push(permutation.templates[j].zEBDUniqueID);
                    }
                    break;
                }
            }
    
            if (bCurrentPathAssigned === false)
            {
                logMessage("Warning (Permutation " + permutation.nameString + "): " + permutation.paths[i][0] + " could not be matched to a record template at position " + permutation.paths[i][1] + ". Are you sure you spelled the file name correctly and didn't assign multiple files to the same position?");
            }
        }
    
        //get list of all templates and subtemplates
    
        for (let i = 0; i < permutation.templates.length; i++)
        {
            generatedRecordList = [];
            collectGeneratedzEBDrecords(permutation.templates[i], generatedRecordList);
            
            //check if the new top-level record is unique
            let bUnique = true;
            for (let j = 0; j < uniqueRecordList.length; j++)
            {
                if (uniqueRecordList[j].zEBDpathSignature === permutation.templates[i].zEBDpathSignature)
                {
                    permutation.templates[i] = uniqueRecordList[j];
                    bUnique = false;
                    break;
                }
            }

            if (bUnique === true)
            {
                if (permutation.templatesToWrite === undefined)
                {
                    permutation.templatesToWrite = [];
                }
                permutation.templatesToWrite.push(...generatedRecordList);
                uniqueRecordList.push(...generatedRecordList);
            }

            // transfer keywords from recordTemplates to permutation
            for (let j = 0; j < generatedRecordList.length; j++)
            {
                if (generatedRecordList[j].zEBDAddKeywords !== undefined)
                {
                    for (let k = 0; k < generatedRecordList[j].zEBDAddKeywords.length; k++)
                    {
                        if (permutation.addKeywords.includes(generatedRecordList[j].zEBDAddKeywords[k]) === false)
                        {
                            permutation.addKeywords.push(generatedRecordList[j].zEBDAddKeywords[k]);
                        }
                    }
                }
            }
        }

        Aux.revertAliasRace(NPCinfo);
    }

    RG.convertUserKeywordsToObjects = function(userKeywords)
    {
        let outputs = [];
        let keywordObject = {};
        for (let i = 0; i < userKeywords.length; i++ )
        {
            keywordObject = {};
            keywordObject["Record Header"] = {};
            keywordObject["Record Header"].Signature = "KYWD";
            keywordObject["EDID - Editor ID"] = userKeywords[i];
            outputs.push(keywordObject);
        }

        return outputs;
    }

    return RG;
};

function assignRecordPathByMap(record, pathMap, assignmentValue)
{
    let bPathAssigned = false;
    let targetPath = assignmentValue[0];
    let refPath = assignmentValue[1];
    let pathMapsForCurrent = pathMap[refPath][record.zEBDUniqueID];

    if (pathMapsForCurrent === undefined) // if the upstream function asked for a path that doesn't exist in this recordTemplate, return false immediately. This is expected behavior.
    {
        return false;
    }

    // Default record check: Remove "Skyrim.esm" prefix from paths to be assigned, to comply with the format expected by the game engine
    if (targetPath.indexOf("Skyrim.esm\\") === 0)
    {
        targetPath = targetPath.replace("Skyrim.esm\\", "");
    }
    else if (targetPath.indexOf("skyrim.esm\\") === 0)
    {
        targetPath = targetPath.replace("skyrim.esm\\", "");
    }

    for (let i = 0; i < pathMapsForCurrent.length; i++)
    {
        Aux.assignValueToObjectPath2(pathMapsForCurrent[i], record, targetPath);
        bPathAssigned = true;
    }

    return bPathAssigned;
}

// Compiles all filled (path-replaced) template records into a categorized object
function collectGeneratedzEBDrecords(record, recordList) 
{
    // check if the record is an zEBDrecord
    if (record.zEBDUniqueID !== undefined)
    { 
        recordList.push(record);      
    }

    if (Aux.isObject(record) === true)
    {
        for (let [attribute, value] of Object.entries(record)) // iterate through each attribute of the record
        {
            // if the attribute is an array, iterate through its elements
            if (Array.isArray(value))
            {
                for (let j = 0; j < value.length; j++)
                {
                    collectGeneratedzEBDrecords(value[j], recordList); // recursively check each element to see if it is a template record
                }
            }
            // if the attribute is not an array, recursively check to see if it is a template record
            else if (value != null)
            {
                collectGeneratedzEBDrecords(value, recordList);
            }
        }
    }
}

function trimPermutationPaths(permutation, trimPaths, fh)
{
    let currentExtension = "";
    let trimPathExtension = "";
    let pathLC = "";
    let toReplace = "";

    for (let j = 0; j < permutation.paths.length; j++)
    {
        currentExtension = fh.getFileExt(permutation.paths[j][0].toLowerCase());
        for (let k = 0; k < trimPaths.length; k++)
        {
            trimPathExtension = trimPaths[k].extension.toLowerCase();
            if (currentExtension === trimPathExtension)
            {
                pathLC = permutation.paths[j][0].toLowerCase();
                toReplace = trimPaths[k].pathToTrim.toLowerCase() + "\\";
                pathLC = pathLC.replace(toReplace, ""); // string.replace is safe because it only replaces the first instance of toReplace
                permutation.paths[j][0] = pathLC;
                break;
            }
        }
    }
}

// This function sets the priority (depth) of each unique recordTemplate (to determine in what order the uniqueRecords must be written to the patch)
// returns the maximum depth of all subrecords
function setRecordTemplatePriorities(uniqueRecordList)
{
    let maxDepth = 0;
    let tmpDepth = 0;

    for (let i = 0; i < uniqueRecordList.length; i++)
    {
        tmpDepth = setRecordTemplatePriority(uniqueRecordList[i], 0, maxDepth);
        if (tmpDepth > maxDepth)
        {
            maxDepth = tmpDepth;
        }
    }

    return maxDepth;
}

// this function sets the priority of a given zEBD top-level record template, and all of its sub-records, based on their depth within the hierarchy
function setRecordTemplatePriorities(obj, depth, maxDepth)
{
    if (obj.zEBDUniqueID !== undefined)
    {
        obj.zEBDpriority = depth;

        if (depth > maxDepth)
        {
            maxDepth = depth;
        }

        depth++; // increment depth for sub-recordTemplates
    }

    for (let [attribute, value] of Object.entries(obj))
    {
        if (Array.isArray(value)) // if the attribute is an array, iterate through its elements
        {
            for (let i = 0; i < value.length; i++)
            {
                maxDepth = setRecordTemplatePriorities(value[i], depth, maxDepth);
            }
        }
        else if (Aux.isObject(value))
        {
            maxDepth = setRecordTemplatePriorities(value, depth, maxDepth);
        }
    }

    return maxDepth;
}

function getGlobalPathFromObjectTemplate(target, object, storageObj, totalPath)
{
    for (let [attribute, value] of Object.entries(object))
    {
        if (typeof value === 'string' && value.toLowerCase().endsWith(target.toLowerCase())) // note that the path in the recordTemplate may look like "x\\y\\z\\target", hence endsWith()
        {
            storageObj.totalPath = totalPath + "\\" + attribute;         
        }

        else if (storageObj.totalPath !== undefined)
        {
            return; // don't look at any more branches if the path has already been found
        }

        else if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                if (Aux.isObject(value[i]))
                {
                    getGlobalPathFromObjectTemplate(target, value[i], storageObj, totalPath + "\\" + attribute + "\\[" + i.toString() + "]");
                }
            }
        }

        else if (Aux.isObject(value))
        {
            getGlobalPathFromObjectTemplate(target, value, storageObj, totalPath + "\\" + attribute);
        }
    }
}

function checkFileTypeAllowed(filePath, excludedExtensions)
{
    let allowed = true;

    let extension = filePath.split('.').pop().toLowerCase();
    if (excludedExtensions.includes(extension))
    {
        allowed = false;
    }

    return allowed;
}


