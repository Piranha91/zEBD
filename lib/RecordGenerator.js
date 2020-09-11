// Note: In this js file, the terminology "record" and "recordTemplate" is used somewhat interchangeably
// Record templates are found in zEBD assets\RecordTemplates. They contain the information that will be written to records in the patch file
// Since the patcher hasn't run yet and therefore no new records have yet been generated, any time this code refers to a "record", it means "recordTemplate."

let Aux = require('./Auxilliary.js');
module.exports = function(logDir, fh)
{
    let RG = {};
    RG.recordTemplates = []; //
    RG.maxPriority = 0;

    RG.generateRecords = function (permutations, settings, recordTemplates, assetPackSettings, helpers)
    {
        let uniqueIDlist = getRecordTemplateUniqueIDs(recordTemplates);
        let excludedExtensions = initializeExcludedExtensions(settings); // file extensions that should not be updated according to the user's settings.
        let categorizedTemplateList = initializeCategorizedTemplateList(assetPackSettings, uniqueIDlist); // generate a list of recordTemplates sorted by their source Asset Pack and sub-sorted by their zEBDUniqueID. Values used to make optimized sub-lists for decreasing search times during record linkage
        let pathMapByPathType = generatePathMapByPathType(assetPackSettings, recordTemplates, excludedExtensions); // tells patcher which recordTemplate to look in for a particular asset path, and what path within the recordTemplate to assign it to
        let pathMapByRecordType = generatePathMapByRecordType(pathMapByPathType, uniqueIDlist);
        let currentName = "";
        let tmpMaxPriority = 0; // maximum depth of recordTemplates

        // get maximum depth of record templates to determine in which order to write them to the plugin (records can't reference other records if they haven't yet been written to plugin)
        for (let i = 0; i < recordTemplates.length; i++)
        {
            tmpMaxPriority = setRecordTemplatePriorities(recordTemplates[i], 0, 0);
            if (tmpMaxPriority > RG.maxPriority)
            {
                RG.maxPriority = tmpMaxPriority;
            }
        }

        for (let i = 0; i < permutations.length; i++)
        {
            if (permutations[i].sourceAssetPack !== currentName)
            {
                currentName = permutations[i].sourceAssetPack;
                helpers.logMessage("Generating records for " + currentName);
            }

            populatePermutationPaths(permutations[i], recordTemplates, categorizedTemplateList, pathMapByPathType, pathMapByRecordType, helpers.logMessage); // replace default template paths with the ones stored in each permutation, and link top-level templates with uniques

            if (i % 1000 === 0 && i !== 0)
            {
                helpers.logMessage("Generated records for " + (i).toString() + " permutations.")
            }
        }
        helpers.logMessage("Generated records for " + (permutations.length).toString() + " permutations.")

        mapSubrecordsToUniques(categorizedTemplateList, RG.maxPriority, pathMapByRecordType, helpers.logMessage); // Link subrecords of unique permutations to their top-level records

        transferTemplateKeywordsToPermutation(permutations); // transfer keywords from recordTemplates to permutations

        RG.recordTemplates = categorizedTemplateList;
    };

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

// This function generates recordTemplates for each permutation.
// Each permutation gets all record templates (as new objects in memory), which are then populated with the filepaths contained within permutation.paths
// Unused recordTemplates are removed from the permutation.
function populatePermutationPaths (permutation, recordTemplates, categorizedTemplateList, pathMapByPathType, pathMapByRecordType, logMessage)
{
    let usedRTUniqueIDs = []; // for figuring out which recordTemplates were actually used
    let bCurrentPathAssigned = false;

    permutation.templates = angular.copy(recordTemplates);
    assignCorrectRaceGenderTemplates(permutation); // filters templates so that only the correct ones for the given subgroup's allowedRaces remain

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

    // remove unused templates from the permutation 
    for (let i = 0; i < permutation.templates.length; i++)
    {
        if (usedRTUniqueIDs.includes(permutation.templates[i].zEBDUniqueID) === false)
        {
            permutation.templates.splice(i, 1);
            i--;
        }
    }

    //get list of all templates and subtemplates

    for (let i = 0; i < permutation.templates.length; i++)
    {
        collectGeneratedzEBDrecords(permutation.templates[i], categorizedTemplateList, permutation.sourceAssetPack, pathMapByRecordType);
    }

    return;
}

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
function collectGeneratedzEBDrecords(record, categorizedTemplateList, zEBDsourceAssetPack, pathMapByRecordType) 
{
    // check if the record is an zEBDrecord
    if (record.zEBDUniqueID !== undefined)
    { 
        let linkIndex = getRecordIndexInList(record, categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack], pathMapByRecordType);
        
        if (linkIndex === -1) // if this record has not yet been encountered
        {
            record.$zEBDLinkTo = {"zEBDUniqueID": record.zEBDUniqueID, "sourceAssetPack": zEBDsourceAssetPack, "index": categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack].length};
            categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack].push(record);
        }
        else // if this record has previously been encountered
        {
            record.$zEBDLinkTo = {"zEBDUniqueID": record.zEBDUniqueID, "sourceAssetPack": zEBDsourceAssetPack, "index": linkIndex};
        }        
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
                    collectGeneratedzEBDrecords(value[j], categorizedTemplateList, zEBDsourceAssetPack, pathMapByRecordType); // recursively check each element to see if it is a template record
                }
            }
            // if the attribute is not an array, recursively check to see if it is a template record
            else if (value != null && attribute !== "$zEBDLinkTo") // skip $zEBDLinkTo or it'll infinitely generate copies of that object and recurse into them
            {
                collectGeneratedzEBDrecords(value, categorizedTemplateList, zEBDsourceAssetPack, pathMapByRecordType);
            }
        }
    }
    return record;
}

function mapSubrecordsToUniques(categorizedTemplateList, maxPriority, pathMapByRecordType, logMessage)
{
    logMessage("Linking subrecords within unique records");
    for (let i = maxPriority; i >= 0; i--)
    {
        for (let [zEBDUniqueID, sublistA] of Object.entries(categorizedTemplateList))
        {
            for (let [sourceAssetPack, sublistB] of Object.entries(sublistA))
            {
                if (sublistB.length > 0 && sublistB[0].zEBDpriority === i)
                {
                    for (let j = 0; j < sublistB.length; j++)
                    {
                        linkUniqueSubRecords(sublistB[j], categorizedTemplateList, sourceAssetPack, pathMapByRecordType);
                    }
                }
            }
        }
    }
}

function linkUniqueSubRecords(obj, categorizedTemplateList, sourceAssetPack, pathMapByRecordType)
{
    let index = -1;
    for (let [attribute, value] of Object.entries(obj))
    {
        if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                if (Aux.isObject(value[i]) && value[i].zEBDUniqueID === undefined)
                {
                    linkUniqueSubRecords(value[i], categorizedTemplateList, sourceAssetPack, pathMapByRecordType);
                }
                else if (value[i].zEBDUniqueID !== undefined)
                {
                    linkRecordValueToUniqueList(value[i], categorizedTemplateList[value[i].zEBDUniqueID][sourceAssetPack], sourceAssetPack, pathMapByRecordType);
                }
            }
        }

        else if (Aux.isObject(value) && value.zEBDUniqueID === undefined)
        {
            linkUniqueSubRecords(value, categorizedTemplateList, sourceAssetPack, pathMapByRecordType);
        }

        else if (value.zEBDUniqueID !== undefined && attribute !== "$zEBDLinkTo") // $zEBDLinkTo also has a zEBDUniqueID value 
        {
            linkRecordValueToUniqueList(value, categorizedTemplateList[value.zEBDUniqueID][sourceAssetPack], sourceAssetPack, pathMapByRecordType);
        }
    }
}

function linkRecordValueToUniqueList(record, list, sourceAssetPack, pathMapByRecordType)
{
    for (let i = 0; i < list.length; i++)
    {
        if (bRecordPathsEquivalent(record, list[i], pathMapByRecordType))
        {
            record.$zEBDLinkTo = {"zEBDUniqueID": record.zEBDUniqueID, "sourceAssetPack": sourceAssetPack, "index": i};
        }
    }
}

function getRecordIndexInList(record, list, pathMapByRecordType)
{
    for (let i = 0; i < list.length; i++)
    {
        if (bRecordPathsEquivalent(record, list[i], pathMapByRecordType))
        {
            return i;
        }
    }
    return -1;
}

function bRecordPathsEquivalent(recA, recB, pathMapByRecordType)
{
    // check if uniqueIDs are the same
    if (recA.zEBDUniqueID !== recB.zEBDUniqueID)
    {
        return false;
    }
    else
    {
        for (let i = 0; i < pathMapByRecordType[recA.zEBDUniqueID].length; i++)
        {
            if (Aux.getValueAtObjectPath2(pathMapByRecordType[recA.zEBDUniqueID][i], recA) !== Aux.getValueAtObjectPath2(pathMapByRecordType[recB.zEBDUniqueID][i], recB))
            {
                return false;
            }
        }
    }
    return true;
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

// assigns the correct recordTemplate to the given permutation based on its allowed races
function assignCorrectRaceGenderTemplates(permutation)
{
    let filteredList = [];
    let bDisallowed = false;

    for (let i = 0; i < permutation.templates.length; i++)
    {
        bDisallowed = false;
        // check gender
        if (permutation.templates[i].zEBDgender != permutation.gender)
        {
            continue;
        }

        // check race
        for (let j = 0; j < permutation.allowedRaces.length; j++)
        {
            if (permutation.templates[i].zEBDsupportedRaces.includes(permutation.allowedRaces[j]) === false)
            {
                bDisallowed = true;
                break;
            }
        }
        if (bDisallowed === true) { continue; }

        filteredList.push(permutation.templates[i]);
    }

    permutation.templates = filteredList;
}

// transfers keywords from filled recordTemplates to the main permutation addKeywords array
function transferTemplateKeywordsToPermutation(permutations)
{
    for (let i = 0; i < permutations.length; i++)
    {
        for (let j = 0; j < permutations[i].templates.length; j++)
        {
            if (permutations[i].templates[j].zEBDAddKeywords != undefined)
            {
                Aux.copyArrayInto(permutations[i].templates[j].zEBDAddKeywords, permutations[i].addKeywords);
            }
        }
        Aux.getArrayUniques(permutations[i].addKeywords);
    }
}

function getRecordTemplateUniqueIDs(recordTemplates)
{
    let uniqueIDlist = [];
    for (let i = 0; i < recordTemplates.length; i++)
    {
        Aux.getAllValuesInObject(recordTemplates[i], uniqueIDlist, "zEBDUniqueID");
    }
    uniqueIDlist = Aux.getArrayUniques(uniqueIDlist);

    return uniqueIDlist;
}

function initializeCategorizedTemplateList(assetPackSettings, uniqueIDlist)
{
    let categorizedTemplateList = {};

    for (let i = 0; i < uniqueIDlist.length; i++)
    {
        categorizedTemplateList[uniqueIDlist[i]] = {};
        for (let j = 0; j < assetPackSettings.length; j++)
        {
            categorizedTemplateList[uniqueIDlist[i]][assetPackSettings[j].groupName] = [];
        }
    }

    return categorizedTemplateList;
}


function generatePathMapByPathType(assetPackSettings, recordTemplates, excludedExtensions)
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

function generatePathMapByRecordType(pathMapByPathType, uniqueIDlist)
{
    let pathPosList = {};
    for (let i = 0; i < uniqueIDlist.length; i++)
    {
        pathPosList[uniqueIDlist[i]] = [];
        for (let list_pathType of Object.values(pathMapByPathType))
        {
            for (let [uniqueID, list_recordType] of Object.entries(list_pathType))
            {
                if (uniqueID === uniqueIDlist[i])
                {
                    pathPosList[uniqueID].push(...list_recordType);
                }
            }
        }
    }

    //not strictly necessary but helps my sanity...
    /*
    for (let newPathMapList of Object.values(pathPosList))
    {
        newPathMapList.sort();
    }*/

    return pathPosList;
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

function initializeExcludedExtensions(settings)
{
    let excludedExtensions = [];
    if (settings.changeTextures === false) { excludedExtensions.push("dds");}
    if (settings.changeMeshes === false) { excludedExtensions.push("nif");}
    return excludedExtensions;
}
