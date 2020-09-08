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
        let filledTemplateList = [];
        let uniqueTemplateList = [];
        let categorizedTemplateList = [] // generate a list of recordTemplates sorted by their source Asset Pack and sub-sorted by their EDID. Values used to make optimized sub-lists for decreasing search times during record linkage
        let recordToPathMap = {}; // tells patcher which recordTemplate to look in for a particular asset path, and what path within the recordTemplate to assign it to
        let excludedExtensions = []; // file extensions that should not be updated according to the user's settings.
        let linkages = []; // array of linked records (for rebuilding record list from JSON - not used normally)
        let currentName = "";

        if (settings.changeTextures === false) { excludedExtensions.push("dds");}
        if (settings.changeMeshes === false) { excludedExtensions.push("nif");}

        categorizedTemplateList = initializeCategorizedTemplateList(assetPackSettings, recordTemplates);
        recordToPathMap = generateRecordPathMap(assetPackSettings, recordTemplates, excludedExtensions);

        for (let i = 0; i < permutations.length; i++)
        {
            if (permutations[i].sourceAssetPack !== currentName)
            {
                currentName = permutations[i].sourceAssetPack;
                helpers.logMessage("Generating records for " + currentName);
            }

            populatePermutationPaths(permutations[i], recordTemplates, filledTemplateList, recordToPathMap, helpers.logMessage); // replace default template paths with the ones stored in each permutation
            // filledTemplateList contains all recordTemplates for all permutations (not yet linked, and not yet unique). As of v1.8, all recordTemplates and sub-RecordTemplates are stamped with the permutation's source asset pack to facilitate faster linking 

            if (i % 1000 === 0 && i !== 0)
            {
                helpers.logMessage("Generated records for " + (i).toString() + " permutations.")
            }
        }
        helpers.logMessage("Generated records for " + (permutations.length).toString() + " permutations.")

        helpers.logMessage("Linking generated records to their subrecords")
        uniqueTemplateList = getUniqueRecordList(filledTemplateList);

        categorizeUniqueRecordList(uniqueTemplateList, categorizedTemplateList);

        linkages = linkUniqueRecords(uniqueTemplateList, categorizedTemplateList); // links unique recordTemplates to their child sub-recordTemplates in memory
        linkPermutationTemplatesToUniqueTemplates(permutations, uniqueTemplateList, helpers.logMessage); // links permutation records to their conterparts in the uniqueTemplateList in memory

        transferTemplateKeywordsToPermutation(permutations); // transfer keywords from recordTemplates to permutations

        RG.maxPriority = setRecordTemplatePriorities(uniqueTemplateList);

        RG.linkageList = linkages;

        RG.recordTemplates = uniqueTemplateList;
    };

    RG.linkPermutationsToJSONRecords = function(permutations, uniqueTemplateList, logMessage) // used to link permutations loaded from JSON to records loaded from JSON. NOT part of the standard record/permutation generation process
    {
        linkPermutationTemplatesToUniqueTemplates(permutations, uniqueTemplateList, logMessage);
    };

    RG.collectGeneratedzEBDrecords = function(record, storageList) // this was originally supposed to be a private function, but is needed by IO module.
    {
        collectGeneratedzEBDrecords(record, storageList);
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
function populatePermutationPaths (permutation, recordTemplates, filledTemplateList, recordToPathMap, logMessage)
{
    let usedRTEDIDlist = []; // for figuring out which recordTemplates were actually used
    permutation.templates = angular.copy(recordTemplates);
    assignCorrectRaceGenderTemplates(permutation); // filters templates so that only the correct ones for the given subgroup's allowedRaces remain

    for (let i = 0; i < permutation.paths.length; i++)
    {
        for (let j = 0; j < permutation.templates.length; j++)
        {
            if (assignRecordPathByMap(permutation.templates[j], recordToPathMap, permutation.paths[i], permutation.nameString, logMessage) === true) // returns true if templates[j] was the correct record type
            {
                if (usedRTEDIDlist.includes(permutation.templates[j].EDID) === false)
                {
                    usedRTEDIDlist.push(permutation.templates[j].EDID);
                }
                break;
            }
        }
    }

    // remove unused templates from the permutation 
    for (let i = 0; i < permutation.templates.length; i++)
    {
        if (usedRTEDIDlist.includes(permutation.templates[i].EDID) === false)
        {
            permutation.templates.splice(i, 1);
            i--;
        }
    }

    //get list of all templates and subtemplates
    for (let i = 0; i < permutation.templates.length; i++)
    {
        collectGeneratedzEBDrecords(permutation.templates[i], filledTemplateList, permutation.sourceAssetPack);
    }

    return;
}

function assignRecordPathByMap(record, pathMap, assignmentValue, permutationName, logMessage)
{
    let bPathAssigned = false;
    let targetPath = assignmentValue[0];
    let refPath = assignmentValue[1];
    let pathMapForCurrent = pathMap[refPath];

    if (pathMapForCurrent === undefined)
    {
        logMessage("Warning in permutation (" + permutationName + "): could not find a reference to path: " + refPath + " in any Record Template.");
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

    for (let i = 0; i < pathMapForCurrent.length; i++)
    {
        if (pathMapForCurrent[i].EDID === record.EDID)
        {
            Aux.assignValueToObjectPath(pathMapForCurrent[i].relativePath, record, targetPath);
            bPathAssigned = true;
        }
    }

    return bPathAssigned;
}

// Compiles all filled (path-replaced) template records into a 1D array
function collectGeneratedzEBDrecords(record, storageList, zEBDsourceAssetPack)
{
    // check if the record is an zEBDrecord
    if (record.zEBDUniqueID != undefined)
    {
        stampZEBDrecords(record, "zEBDsourceAssetPack", zEBDsourceAssetPack); // linking optimization: stamp all sub-records here so that they can be matched recursively
        storageList.push(angular.copy(record)); // store the template record in the array.
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
                    collectGeneratedzEBDrecords(value[j], storageList, zEBDsourceAssetPack); // recursively check each element to see if it is a template record
                }
            }
            // if the attribute is not an array, recursively check to see if it is a template record
            else if (value != null)
            {
                collectGeneratedzEBDrecords(value, storageList, zEBDsourceAssetPack);
            }
        }
    }
    return record;
}

// adds a [key,value] to the given zEBD record template and all sub-record templates.
function stampZEBDrecords(object, stampKey, stampValue)
{
    // if the current object is a recordTemplate, stamp it
    if (object.zEBDUniqueID !== undefined)
    {
        object[stampKey] = stampValue;
    }

    for (let [attribute, value] of Object.entries(object))
    {
        if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                stampZEBDrecords(value[i], stampKey, stampValue);
            }
        }
        else if (Aux.isObject(value))
        {
            stampZEBDrecords(value, stampKey, stampValue);
        }
    }
}

// Generate Unique Records Code Block
// This function takes all path-filled record templates in a 1D array and returns a 1D array containing only the unique templates.
// This function is necessary because different permutations can contain the same record template (as two different objects in memory)
// (e.g. if one permutation contains bretonHead + maleBody1 and another contains bretonHead + malebody2, "bretonHead" will appear twice in the recordList generated by function collectGeneratedzEBDrecords)
// sourceAssetPackList and EDIDlist are used to make optimized sub-lists for faster searching during linkage
function getUniqueRecordList(recordList)
{
    let uniques = [];
    let matched = false;

    for (let i = 0; i < recordList.length; i++)
    {
        matched = false;

        for (let j = 0; j < uniques.length; j++)
        {
            if (recordList[i].zEBDsourceAssetPack === uniques[j].zEBDsourceAssetPack && recordList[i].EDID === uniques[j].EDID && angular.equals(recordList[i], uniques[j]) === true) // check zEBDassetPackSource and EDID before angular.equals to speed up algorithm. Note that the "EDID" attribute doesn't get a number assigned until right before writing to plugin, so this is safe.
            {
                matched = true;
                break;
            }
        }
        if (matched === false)
        {
            uniques.push(recordList[i]);
        }
    }
    return uniques;
}
// End Generate Unique Records Code Block

function categorizeUniqueRecordList(recordList, categorizedList)
{
    for (let i = 0; i < recordList.length; i++)
    {
        // push an object consisting of {record, index of record}. Note: Index is used to record position in the unique record list, which is used by IO.loadGeneratedPermutations_Records()
        // adding the index as a property of the record is not suitable because it breaks the comparison of the recordTemplates in this list vs. those attached to permutations (which would not have this property) using angular.equals or json.stringify
        categorizedList[recordList[i].zEBDsourceAssetPack][recordList[i].EDID].push({"record": recordList[i], "index": i}); 
    }
}

// Link Unique Records Block
// This function goes through all unique recordTemplates and recursively links them to their child recordTemplates (in memory)
function linkUniqueRecords(uniqueRecordList, categorizedTemplateList)
{
    let linkages = [];
    for (let i = 0; i < uniqueRecordList.length; i++)
    {
        linkages.push(linkUniqueRecord(uniqueRecordList[i], uniqueRecordList, categorizedTemplateList, "", false));
    }

    return linkages;
}

// This function recursively links a recordTemplate to its child recordTemplates in memory
// Example: uniqueRecordList contains Armature "MaleBodyTorso" and Worn Armor "MaleBody"
//          MaleBody contains armature records which contain "MaleBodyTorso" but MaleBody.MaleBodyTorso is a different object in memory than the MaleBodyTorso in uniqueRecordList
//          This function will replace MaleBody.MaleBodyTorso with the MaleBodyTorso in UniqueRecordList, so and changes to MaleBodyTorso will carry through to MaleBody
//          This way a formID can be assigned to MaleBodyTorso when its record is created, and then be referenced when creating MaleBody
//          bStopRecording is for the currentLinkage array, to prevent the recording of recursive links past the first layer (which will screw up the generated linkage list which is only supposed to be direct links for the given record)
//    Note for clarity: 
//                      For the current zEBD run, the actual linkage in memory is achieved in the two "record[attribute][i] = uniqueRecordList[j];" lines
//                      For storing the linkages for JSON export, the currentLinkage array is used. The prefix and bStopRecording variables are used to support this storing
function linkUniqueRecord(record, uniqueRecordList, categorizedTemplateList, prefix, bStopRecording)
{
    let currentLinkage = [];
    let categorizedSubList = [];
    let oPrefix = prefix;
    
    if (Aux.isObject(record) === true)
    {
        for (let [attribute, value] of Object.entries(record)) // iterate through each attribute of the record
        {
            if (Array.isArray(value)) // if the attribute is an array, iterate through its elements
            {
                for (let i = 0; i < value.length; i++)
                {
                    prefix = oPrefix + attribute + "\\[" + i.toString() + "]"
                    if (value[i].zEBDUniqueID != undefined) // if the array element is a child recordTemplate:
                    {
                        // iterate through uniqueRecordList sublist and find a match for this recordTemplate
                        categorizedSubList = categorizedTemplateList[value[i].zEBDsourceAssetPack][value[i].EDID];
                        for (let j = 0; j < categorizedSubList.length; j++)
                        {
                            if (angular.equals(value[i], categorizedSubList[j].record) === true) // check zEBDassetPackSource and record type before angular.equals to speed up algorithm
                            {
                                record[attribute][i] = categorizedSubList[j].record; // link the recordTemplate (array element) to uniqueRecordList
                                
                                if (bStopRecording === false)
                                {
                                    currentLinkage.push([prefix, categorizedSubList[j].index]); // attribute is already incorporated into prefix (along with the array position).
                                }

                                currentLinkage.push(...linkUniqueRecord(record[attribute][i], uniqueRecordList, categorizedTemplateList, prefix + "\\", true)); // recursively link the recordTemplate's child recordTemplates
                                break; // new in 1.8 because I'm an idiot.
                            }
                        }
                    }
                    else if (Aux.isObject(value[i])) // if the array element is not a child recordTemplate but is an object:
                    {
                        currentLinkage.push(...linkUniqueRecord(value[i], uniqueRecordList, categorizedTemplateList, prefix + "\\", bStopRecording)); // recursively link the recordTemplate's child recordTemplates
                    }
                    prefix = oPrefix; // revert to avert "contaminating" other [attribute, value] pairs that get identified as zEBDrecords (if (value != null && value["zEBDUniqueID"] != undefined))
                }
            }
            // if the record is not an array
            else
            {
                // check if the attribute is an zEBDrecord
                if (value != null && value["zEBDUniqueID"] != undefined)
                {
                    categorizedSubList = categorizedTemplateList[value.zEBDsourceAssetPack][value.EDID];
                    for (let j = 0; j < categorizedSubList.length; j++)
                    {
                        if (angular.equals(value, categorizedSubList[j].record) === true) // check zEBDassetPackSource and record type before angular.equals to speed up algorithm
                        {
                            record[attribute] = categorizedSubList[j].record; // link the recordTemplate (attribute) to uniqueRecordList

                            if (bStopRecording === false)
                            {
                                currentLinkage.push([prefix + attribute, categorizedSubList[j].index]);
                            }
                            currentLinkage.push(...linkUniqueRecord(record[attribute], uniqueRecordList, categorizedTemplateList, prefix, true)); // recursively link the recordTemplate's child recordTemplates
                            break; // new in 1.8 because I'm an idiot.
                        }
                    }
                }
                else if (Aux.isObject(value)) // if the array element is not a child recordTemplate but is an object:
                {
                    prefix = oPrefix + attribute + "\\";
                    currentLinkage.push(...linkUniqueRecord(value, uniqueRecordList, categorizedTemplateList, prefix, bStopRecording)); // recursively link the recordTemplate's child recordTemplates
                    prefix = oPrefix; // revert to avert "contaminating" other [attribute, value] pairs that get identified as zEBDrecords (if (value != null && value["zEBDUniqueID"] != undefined))
                }
            }
        }
    }

    return currentLinkage;
}

// This function links each permutation's record templates to their corresponding unique representatives in uniqueRecordList
// Does not need to be called recursively because uniqueRecordList is already self-linked, so once the top-level permutation.record is linked, its children will be as well
function linkPermutationTemplatesToUniqueTemplates(permutations, uniqueRecordList, logMessage)
{
    for (let i = 0; i < permutations.length; i++)
    {
        for (let j = 0; j < permutations[i].templates.length; j++)
        {
            for (let k = 0; k < uniqueRecordList.length; k++)
            {
                if (angular.equals(permutations[i].templates[j], uniqueRecordList[k]) === true)
                {
                    permutations[i].templates[j] = uniqueRecordList[k];
                    break;
                }
            }
        }

        if (i % 1000 === 0 && i !== 0)
        {
            logMessage("Linked records for " + i.toString() + " permutations");
        }
    }
    logMessage("Linked records for " + permutations.length.toString() + " permutations");
}
// End Link Unique Records Block

// TemplatePriority Code Block

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

// this function sets the priority (depth) of the given record
// returns the maximum depth reached in record and its subrecords
// records themselves are updated by reference
function setRecordTemplatePriority(obj, currentDepth, maxPriority)
{
    if (currentDepth > maxPriority) { maxPriority = currentDepth; }

    // "record.zEBDpriority === undefined": if the current record's priority has not yet been set, set it
    // "currentDepth > record.zEBDpriority"": uniqueRecordList is a 1D list containing "flattened" records and their subrecords.
    // If the previous priority had been set looking at a record that is actually a subrecord, update it with its "real" depth
    // Example: uniqueRecordList contains Armature "MaleBodyTorso" and Worn Armor "MaleBody" which includes "MaleBodyTorso"
    // If this function receives record = MaleBodyTorso first, then MaleBodyTorso will get a priority of 0.
    // When this function then receives MaleBody, it will recurse through MaleBody.MaleBodyTorso, which will get an updated priority of 1

    if (obj.zEBDUniqueID !== undefined && (obj.zEBDpriority === undefined || currentDepth > obj.zEBDpriority)) // only set zEBDpriority for objects that are records
    {
        obj.zEBDpriority = currentDepth;
    }

    for (let [attribute, value] of Object.entries(obj)) // iterate through each attribute of the obj
    {
        if (Array.isArray(value)) // if the attribute is an array, iterate through its elements
        {
            for (let i = 0; i < value.length; i++)
            {
                if (value[i].zEBDUniqueID != undefined) // if the array element is a child recordTemplate:
                {
                    maxPriority = setRecordTemplatePriority(value[i], currentDepth + 1, maxPriority); // recursively call this function on the element
                }
                else if (Aux.isObject(value[i])) // if the array element is an object that is not a obj template, recursively call this function to check if it contains obj templates within it, but without incrementing the depth
                {
                    maxPriority = setRecordTemplatePriority(value[i], currentDepth, maxPriority); // recursively call this function on the element
                }
            }
        }
        // if the obj is not an array
        else
        {
            // check if the attribute is an zEBDrecord
            if (value != null && value["zEBDUniqueID"] != undefined)
            {
                maxPriority = setRecordTemplatePriority(value, currentDepth + 1, maxPriority); // recursively call this function on the attribute
            }
            // if the attribute is an object that is not a obj template, recursively call this function to check if it contains obj templates within it, but without incrementing the depth
            else if (Aux.isObject(value)) 
            {
                maxPriority = setRecordTemplatePriority(value, currentDepth, maxPriority); // recursively call this function on the element
            }
        }
    }

    return maxPriority;
}

// End TemplatePriority Code Block

//Other function Code Block
// This function assigns the correct recordTemplate to the given permutation based on its allowed races
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

function initializeCategorizedTemplateList(assetPackSettings, recordTemplates)
{
    let EDIDlist = [];
    for (let i = 0; i < recordTemplates.length; i++)
    {
        getAllValuesInObject(recordTemplates[i], EDIDlist, "EDID");
    }
    EDIDlist = Aux.getArrayUniques(EDIDlist);

    let categorizedTemplateList = {};
    for (let i = 0; i < assetPackSettings.length; i++)
    {
        categorizedTemplateList[assetPackSettings[i].groupName] = {};
        for (let j = 0; j < EDIDlist.length; j++)
        {
            categorizedTemplateList[assetPackSettings[i].groupName][EDIDlist[j]] = [];
        }
    }

    return categorizedTemplateList;
}

function getAllValuesInObject(object, storageList, searchTerm)
{
    if (object[searchTerm] !== undefined)
    {
        storageList.push(object[searchTerm]);
    }
    
    for (let [attribute, value] of Object.entries(object))
    {
        if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                if (Aux.isObject(value[i]))
                {
                    getAllValuesInObject(value[i], storageList, searchTerm);
                }
            }
        }

        else if (Aux.isObject(value))
        {
            getAllValuesInObject(value, storageList, searchTerm);
        }
    }
}

function generateRecordPathMap(assetPackSettings, recordTemplates, excludedExtensions)
{
    // get list of all paths in all subgroups
    let paths = [];
    let tmpPaths = [];
    for (let i = 0; i < assetPackSettings.length; i++)
    {
        for (let j = 0; j < assetPackSettings[i].subgroups.length; j++)
        {
            tmpPaths = [];
            getAllValuesInObject(assetPackSettings[i].subgroups[j], tmpPaths, "paths");
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

    let tmpPathStorageObj = {};
    let pathMapping = {};
    for (let i = 0; i < paths.length; i++)
    {
        pathMapping[paths[i]] = [];
        for (let j = 0; j < recordTemplates.length; j++)
        {
            tmpPathStorageObj = {"EDID": recordTemplates[j].EDID};
            getGlobalPathFromObjectTemplate(paths[i], recordTemplates[j], tmpPathStorageObj, "");
            if (tmpPathStorageObj.totalPath !== undefined)
            {
                pathMapping[paths[i]].push({"relativePath": tmpPathStorageObj.totalPath.substring(1), "EDID": recordTemplates[j].EDID}); // substring to cut off leading '\'
            }
        }
    }

    return pathMapping;
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