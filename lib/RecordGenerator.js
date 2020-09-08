// Note: In this js file, the terminology "record" and "recordTemplate" is used somewhat interchangeably
// Record templates are found in zEBD assets\RecordTemplates. They contain the information that will be written to records in the patch file
// Since the patcher hasn't run yet and therefore no new records have yet been generated, any time this code refers to a "record", it means "recordTemplate."

let Aux = require('./Auxilliary.js');
module.exports = function(logDir, fh)
{
    let RG = {};
    RG.recordTemplates = []; //
    RG.maxPriority = 0;

    RG.generateRecords = function (permutations, settings, recordTemplates, helpers)
    {
        let filledTemplateList = [];
        let uniqueTemplateList = [];
        let categorizedTemplateList = {};
        let sourceAssetPackList = []; // list of all asset packs used to make permutations. Values used to make optimized sub-lists for increasing search times during record linkage
        let EDIDlist = []; // list of all EDID values supplied by recordTemplates. Values used to make optimized sub-lists for increasing search times during record linkage
        let excludedExtensions = []; // file extensions that should not be updated according to the user's settings.
        let linkages = []; // array of linked records (for rebuilding record list from JSON - not used normally)
        let currentName = "";

        if (settings.changeTextures === false) { excludedExtensions.push("dds");}
        if (settings.changeMeshes === false) { excludedExtensions.push("nif");}

        for (let i = 0; i < permutations.length; i++)
        {
            if (permutations[i].sourceAssetPack !== currentName)
            {
                currentName = permutations[i].sourceAssetPack;
                helpers.logMessage("Generating records for " + currentName);
            }

            populatePermutationPaths(permutations[i], recordTemplates, fh, filledTemplateList, excludedExtensions, helpers.logMessage); // replace default template paths with the ones stored in each permutation
            // filledTemplateList contains all recordTemplates for all permutations (not yet linked, and not yet unique). As of v1.8, all recordTemplates and sub-RecordTemplates are stamped with the permutation's source asset pack to facilitate faster linking 

            if (i % 1000 === 0 && i !== 0)
            {
                helpers.logMessage("Generated records for " + (i).toString() + " permutations.")
            }
        }
        helpers.logMessage("Generated records for " + (permutations.length).toString() + " permutations.")

        helpers.logMessage("Linking generated records to their subrecords (this may take a few minutes if you have >10,000 permutations)")
        uniqueTemplateList = getUniqueRecordList(filledTemplateList, sourceAssetPackList, EDIDlist);
        categorizedTemplateList = categorizeUniqueRecordList(uniqueTemplateList, sourceAssetPackList, EDIDlist)

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

// Populate Permutation Paths Code Block

// This function generates recordTemplates for each permutation.
// Each permutation gets all record templates (as new objects in memory), which are then populated with the filepaths contained within permutation.paths
// Unused recordTemplates are removed from the permutation.
function populatePermutationPaths (permutation, recordTemplates, fh, filledTemplateList, excludedExtensions, logMessage)
{
    let bFound;
    permutation.templates = angular.copy(recordTemplates);
    assignCorrectRacialTemplates(permutation); // filters templates so that only the correct ones for the given subgroup's allowedRaces remain

    for (let i = 0; i < permutation.paths.length; i++)
    {
        bFound = searchRecordListForFilePath(permutation.paths[i], permutation.templates, fh, excludedExtensions);
        if (bFound === false)
        {
            logMessage("Warning (Permutation " + permutation.nameString + "): " + permutation.paths[i][0] + " could not be matched to a record template at position " + permutation.paths[i][1] + ". Are you sure you spelled the file name correctly and didn't assign multiple files to the same position?");
        }
    }

    // remove unused templates from the permutation
    for (let i = 0; i < recordTemplates.length; i++)
    {
        for (let j = 0; j < permutation.templates.length; j++)
        {
            if (angular.equals(recordTemplates[i], permutation.templates[j]) === true)
            {
                permutation.templates.splice(j, 1);
                j--;
            }
        }
    }

    //get list of all templates and subtemplates
    for (let i = 0; i < permutation.templates.length; i++)
    {
        collectGeneratedzEBDrecords(permutation.templates[i], filledTemplateList, permutation.sourceAssetPack);
    }

    return;
}

// This function takes a path from permutation.paths and looks through each of the permutation's recordTemplates to find a path with a matching filename
// path is an array[2] where [0] is the path to be used and [1] is the filename (e.g. [textures\myAssetPatck\actors\character\male\malehands_1.dds, malehands_1.dds]
function searchRecordListForFilePath(path, records, fh, excludedExtensions)
{
    let bFound = [false];
    for (let i = 0; i < records.length; i++)
    {
        updateRecordFilePath(path, records[i], fh, bFound, excludedExtensions);
        if (bFound[0] === true)
        {
            break;
        }
    }
    return bFound[0];
}

// This function takes a path (passed from permutation.paths) and looks recursively through a recordTemplate and its subRecordTemplates for the path
// path is an array[2] where [0] is the path to be used and [1] is the filename (e.g. [textures\myAssetPatck\actors\character\male\malehands_1.dds, malehands_1.dds]
function updateRecordFilePath(path, record, fh, bFound, excludedExtensions)
{
    let updatedValue = "";
    for (let [attribute, value] of Object.entries(record)) // iterate through each attribute of the record
    {
        // if the attribute is an array, iterate through its elements and recursively call this function on each element
        if (Array.isArray(value))
        {
            for (let j = 0; j < value.length; j++)
            {
                updatedValue = updateRecordFilePath(path, value, fh, bFound, excludedExtensions);
                if (bFound[0] === true)
                {
                    break;
                }
            }
        }
        // if the attribute is not an array, check if it contains the path
        else
        {
            updatedValue = parseAttribute(path, fh, bFound, value, excludedExtensions);

            if (bFound[0] === true)
            {
                record[attribute] = updatedValue;
            }
        }
    }
    return record;
}

// This function examines a recordTemplate's attribute to see if it matches the path
// path is an array[2] where [0] is the path to be used and [1] is the filename (e.g. [textures\myAssetPatck\actors\character\male\malehands_1.dds, malehands_1.dds]
function parseAttribute(path, fh, bFound, attribute, excludedExtensions)
{
    // check if attribute is a string
    if (typeof attribute === 'string' || attribute instanceof String)
    {
        // check if the attribute is a path that contains the same file name as the input path's file name
        if (checkFilenamesSame(path[1], attribute, fh) === true) // path[1] contains the filename to match
        {
            bFound[0] = true;
            if (checkFileTypeAllowed(path[0], excludedExtensions) === true) // make sure the user is allowing patcher to change this type of file
            {
                // Default record check: Remove "Skyrim.esm" prefix
                if (path[0].indexOf("Skyrim.esm\\") === 0)
                {
                    path[0] = path[0].replace("Skyrim.esm\\", "");
                }
                else if (path[0].indexOf("skyrim.esm\\") === 0)
                {
                    path[0] = path[0].replace("skyrim.esm\\", "");
                }

                // assign the path to the current record
                attribute = path[0]; // if the filename is the same, update it with the path from the permutation. path[0] contains the path to use
            }
        }
    }

    // check if attribute is another record
    if (Aux.isObject(attribute) === true)
    {
        // if so, recursively search that record for the path
        updateRecordFilePath(path, attribute, fh, bFound, excludedExtensions);
    }
    return attribute;
}

// This function checks if two strings are paths with the same filenames
function checkFilenamesSame(path1, path2, fh)
{
    let file1 = fh.getFileName(path1).toLowerCase();
    let file2 = fh.getFileName(path2).toLowerCase();
    if (file1 === file2)
    {
        return true;
    }
    else {return  false; }
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

// This function compiles all filled (path-replaced) template records into a 1D array
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
// END Populate Permutation Paths Code Block

function stampZEBDrecords(object, stampName, stampValue)
{
    // if the current object is a recordTemplate, stamp it
    if (object.zEBDUniqueID !== undefined)
    {
        object[stampName] = stampValue;
    }

    for (let [attribute, value] of Object.entries(object))
    {
        if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                stampZEBDrecords(value[i], stampName, stampValue);
            }
        }
        else if (Aux.isObject(value))
        {
            stampZEBDrecords(value, stampName, stampValue);
        }
    }
}

// Generate Unique Records Code Block
// This function takes all path-filled record templates in a 1D array and returns a 1D array containing only the unique templates.
// This function is necessary because different permutations can contain the same record template (as two different objects in memory)
// (e.g. if one permutation contains bretonHead + maleBody1 and another contains bretonHead + malebody2, "bretonHead" will appear twice in the recordList generated by function collectGeneratedzEBDrecords)
// sourceAssetPackList and EDIDlist are used to make optimized sub-lists for faster searching during linkage
function getUniqueRecordList(recordList, sourceAssetPackList, EDIDlist)
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
            if (sourceAssetPackList.includes(recordList[i].zEBDsourceAssetPack) === false)
            {
                sourceAssetPackList.push(recordList[i].zEBDsourceAssetPack);
            }
            if (EDIDlist.includes(recordList[i].EDID) === false)
            {
                EDIDlist.push(recordList[i].EDID);
            }
        }
    }
    return uniques;
}
// End Generate Unique Records Code Block

// split the unique record list by source asset pack and EDID type
function categorizeUniqueRecordList(recordList, sourceAssetPackList, EDIDlist)
{
    let categorizedList = {};
    // set up categories by source asset pack and EDID type
    for (let i = 0; i < sourceAssetPackList.length; i++)
    {
        categorizeUniqueRecordList[sourceAssetPackList[i]] = {};
        for (let j = 0; j < EDIDlist.length; j++)
        {
            categorizeUniqueRecordList[sourceAssetPackList[i]][EDIDlist[j]] = [];
        }
    }

    // populate list
    for (let i = 0; i < recordList.length; i++)
    {
        //recordList[i].zEBDuniqueRecordIndex = i;
        // push an object consisting of {record, index of record}. Note: Index is used to record position in the unique record list, which is used by IO.loadGeneratedPermutations_Records()
        // adding the index as a property of the record is not suitable because it breaks the comparison of the recordTemplates in this list vs. those attached to permutations (which would not have this property) using angular.equals or json.stringify
        categorizeUniqueRecordList[recordList[i].zEBDsourceAssetPack][recordList[i].EDID].push({"record": recordList[i], "index": i}); 
    }

    return categorizeUniqueRecordList;
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
function assignCorrectRacialTemplates(permutation)
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