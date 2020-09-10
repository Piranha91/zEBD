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
        let filledTemplateList = initializeFilledTemplateList(assetPackSettings);
        let uniqueTemplateList = [];
        let categorizedTemplateList = [] // generate a list of recordTemplates sorted by their source Asset Pack and sub-sorted by their zEBDUniqueID. Values used to make optimized sub-lists for decreasing search times during record linkage
        let recordToPathMap = {}; // tells patcher which recordTemplate to look in for a particular asset path, and what path within the recordTemplate to assign it to
        let excludedExtensions = []; // file extensions that should not be updated according to the user's settings.
        let linkages = []; // array of linked records (for rebuilding record list from JSON - not used normally)
        let currentName = "";
        let tmpMaxPriority = 0; // maximum depth of recordTemplates

        if (settings.changeTextures === false) { excludedExtensions.push("dds");}
        if (settings.changeMeshes === false) { excludedExtensions.push("nif");}

        // get maximum depth of record templates to determine in which order to write them to the plugin (records can't reference other records if they haven't yet been written to plugin)
        for (let i = 0; i < recordTemplates.length; i++)
        {
            tmpMaxPriority = setRecordTemplatePriorities(recordTemplates[i], 0, 0);
            if (tmpMaxPriority > RG.maxPriority)
            {
                RG.maxPriority = tmpMaxPriority;
            }
        }

        categorizedTemplateList = initializeCategorizedTemplateList(assetPackSettings, recordTemplates);
        recordToPathMap = generateRecordPathMap(assetPackSettings, recordTemplates, excludedExtensions);

        for (let i = 0; i < permutations.length; i++)
        {
            if (permutations[i].sourceAssetPack !== currentName)
            {
                currentName = permutations[i].sourceAssetPack;
                helpers.logMessage("Generating records for " + currentName);
            }

            populatePermutationPaths(permutations[i], recordTemplates, categorizedTemplateList, recordToPathMap, helpers.logMessage); // replace default template paths with the ones stored in each permutation
            // filledTemplateList contains all recordTemplates for all permutations (not yet linked, and not yet unique). As of v1.8, all recordTemplates and sub-RecordTemplates are stamped with the permutation's source asset pack to facilitate faster linking 

            if (i % 1000 === 0 && i !== 0)
            {
                helpers.logMessage("Generated records for " + (i).toString() + " permutations.")
            }
        }
        helpers.logMessage("Generated records for " + (permutations.length).toString() + " permutations.")

        helpers.logMessage("Linking generated records to their subrecords")
        mapRecordsToUniques(filledTemplateList, categorizedTemplateList, RG.maxPriority, helpers.logMessage); // makes all recordTemplates with the same values point to the same address in memory, so that when one of them gets a formID assigned it applies to all
        //mapRecordsToUniques(filledTemplateList, categorizedTemplateList, this.maxPriority); // makes all recordTemplates with the same values point to the same address in memory, so that when one of them gets a formID assigned it applies to all
        //getUniqueRecordList(filledTemplateList, categorizedTemplateList);

        // categorizeUniqueRecordList(uniqueTemplateList, categorizedTemplateList);

        //linkages = linkUniqueRecords(uniqueTemplateList, categorizedTemplateList); // links unique recordTemplates to their child sub-recordTemplates in memory
        //linkPermutationTemplatesToUniqueTemplates(permutations, uniqueTemplateList, helpers.logMessage); // links permutation records to their conterparts in the uniqueTemplateList in memory

        transferTemplateKeywordsToPermutation(permutations); // transfer keywords from recordTemplates to permutations

        //RG.maxPriority = setRecordTemplatePriorities(uniqueTemplateList);

        RG.linkageList = linkages;

        RG.recordTemplates = categorizedTemplateList;
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
function populatePermutationPaths (permutation, recordTemplates, categorizedTemplateList, recordToPathMap, logMessage)
{
    let usedRTUniqueIDs = []; // for figuring out which recordTemplates were actually used
    permutation.templates = angular.copy(recordTemplates);
    assignCorrectRaceGenderTemplates(permutation); // filters templates so that only the correct ones for the given subgroup's allowedRaces remain

    for (let i = 0; i < permutation.paths.length; i++)
    {
        for (let j = 0; j < permutation.templates.length; j++)
        {
            if (assignRecordPathByMap(permutation.templates[j], recordToPathMap, permutation.paths[i], permutation.nameString, logMessage) === true) // returns true if templates[j] was the correct record type
            {
                if (usedRTUniqueIDs.includes(permutation.templates[j].zEBDUniqueID) === false)
                {
                    usedRTUniqueIDs.push(permutation.templates[j].zEBDUniqueID);
                }
                break;
            }
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
        collectGeneratedzEBDrecords(permutation.templates[i], categorizedTemplateList, permutation.sourceAssetPack, i);
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
        if (pathMapForCurrent[i].zEBDUniqueID === record.zEBDUniqueID)
        {
            Aux.assignValueToObjectPath(pathMapForCurrent[i].relativePath, record, targetPath);
            bPathAssigned = true;
        }
    }

    return bPathAssigned;
}

////////////////////////////
//DEBUGG


// get rid of "index" parameter in function below when finished debugging


///

// Compiles all filled (path-replaced) template records into a 1D array
function collectGeneratedzEBDrecords(record, categorizedTemplateList, zEBDsourceAssetPack, index)  /// get rid of index because it isn't doing anything!!
{
    // check if the record is an zEBDrecord
    if (record.zEBDUniqueID !== undefined)
    {
        // commented out below
        //stampZEBDrecords(record, "zEBDsourceAssetPack", zEBDsourceAssetPack); // linking optimization: stamp all sub-records here so that they can be matched recursively
        
        
        //let linkIndex = getRecordIndexInList(record, categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack]); // commented out due to stack size exceeded
        let linkIndex = -1;
        for (let i = 0; i < categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack].length; i++)
        {
            if (angular.equals(record, categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack][i]))
            {
                linkIndex = i;
                break;
            }
        }
        
        if (linkIndex === -1) // if this record has not yet been encountered
        {
            record.$zEBDLinkTo = {"zEBDUniqueID": record.zEBDUniqueID, "sourceAssetPack": zEBDsourceAssetPack, "index": categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack].length};
            categorizedTemplateList[record.zEBDUniqueID][zEBDsourceAssetPack].push(record); // new in 1.8. Not sure why I was using angular.copy before, but it's more efficient to directly push the record because then it's directly linked in memory between the filled 1D record list and the permutation's record list
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
                    collectGeneratedzEBDrecords(value[j], categorizedTemplateList, zEBDsourceAssetPack, index); // recursively check each element to see if it is a template record
                }
            }
            // if the attribute is not an array, recursively check to see if it is a template record
            else if (value != null && attribute !== "$zEBDLinkTo") // skip $zEBDLinkTo or it'll infinitely generate copies of that object and recurse into them
            {
                collectGeneratedzEBDrecords(value, categorizedTemplateList, zEBDsourceAssetPack, index);
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

/*
function mapRecordsToUniques(recordList, categorizedTemplateList, maxPriority)
{
    let uniques = [];
    let matched = false;
    
    for (let priority = 0; priority <= maxPriority; priority++)
    {
        for (let i = 0; i < recordList.length; i++)
        {
            if (recordList[i].zEBDpriority === priority)
            {
                uniques = categorizedTemplateList[recordList[i].zEBDUniqueID][recordList[i].zEBDsourceAssetPack];

                matched = false;

                let debug = recordList[i];
                for (let j = 0; j < uniques.length; j++)
                {
                    if (angular.equals(recordList[i], uniques[j]) === true)
                    {
                        matched = true; // link the matching record in memory
                        recordList[i] = uniques[j]; // since recordList points to the same memory address as permutation[a].templates[b], this also links each permutation's template to the unique list              
                        break;
                    }
                }
                if (matched === false)
                {
                    uniques.push(recordList[i]);
                }
            }
        }
    }
}
*/


// Note on strategy
// filledTemplateList contains all records from all permutations, subdivided by the permutation's source asset pack
// Upon determination of whether the same record (containing all same values) has been found, it gets stored into categorizedTemplateList where it is further subdivided by the record type (zEBDUniqueID). This futher subdivision reduces the time needed to search for a match in subsequent iterations
// When a record is determined to be unique, it gets stored both in categorizedTemplateList (for rapid matching in subsequent iterations) and in uniqueListBySource where it is sorted only by its source asset pack
// The unique records in uniqueListBySource get recursively linked to their subrecords

function mapRecordsToUniques(filledTemplateList, categorizedTemplateList, maxPriority, logMessage)
{
    let uniques = [];
    let matched = false;
    let linkDispString = "";
    let linkCount = 0;

    let uniqueListBySource = {}; // same as filledTemplateList but holds only unique records

    /*
    //get unique top-level records
    for (let [sourceAssetPack, recordList] of Object.entries(filledTemplateList))
    {
        linkCount = 0;
        // update user
        if (sourceAssetPack !== linkDispString)
        {
            linkDispString = sourceAssetPack;
            logMessage("Linking permutations to records for " + sourceAssetPack);
        }
        //
        uniqueListBySource[sourceAssetPack] = []; // for linking subrecords  /// DEBUG???

        for (let i = 0; i < recordList.length; i++)
        {
            uniques = categorizedTemplateList[recordList[i].zEBDUniqueID][sourceAssetPack]; // this is empty when this function is called, and populated by this function
            matched = false;
            for (let j = 0; j < uniques.length; j++)
            {
                if (angular.equals(recordList[i], uniques[j]) === true)
                //if (bzEBDRecordTemplatesEquivalent(recordList[i], uniques[j]) === true) SLOW!!!
                {
                    matched = true; // link the matching record in memory
                    //recordList[i] = uniques[j]; // since recordList points to the same memory address as permutation[a].templates[b], this also links each permutation's template to the unique list
                    recordList[i].$zEBDLinkTo = {"zEBDUniqueID": recordList[i].zEBDUniqueID, "sourceAssetPack": sourceAssetPack, "index": j};        
                    break;
                }
            }
            if (matched === false)
            {
                recordList[i].$zEBDLinkTo = {"zEBDUniqueID": recordList[i].zEBDUniqueID, "sourceAssetPack": sourceAssetPack, "index": uniques.length}; // if moving this line below uniques.push, remember to update index to uniques.length - 1 
                uniques.push(recordList[i]);
                uniqueListBySource[sourceAssetPack].push(recordList[i]);
            }

            linkCount++;
            if (linkCount % 1000 === 0)
            {
                logMessage("Linked " + linkCount.toString() + " records");
            }
        }
        logMessage("Linked " + linkCount.toString() + " records");
    }*/

    // link subrecords of unique top-level records to their corrsesponding top-level records

    let torso1 = categorizedTemplateList["FemaleTorso"]["Bijin Skin 4K CBBE Elder Only (For use alongside Demoniac)"][0];
    let torso2 = categorizedTemplateList["FemaleTorso"]["Bijin Skin 4K CBBE Elder Only (For use alongside Demoniac)"][1];

    let etc1 = torso1["Female world model"]["MO3S - Alternate Textures"][0]["New Texture"];
    let etc2 = torso2["Female world model"]["MO3S - Alternate Textures"][0]["New Texture"];


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
                        linkUniqueSubRecords(sublistB[j], categorizedTemplateList, sourceAssetPack, etc2); // get rid of the second sublistB[j] when finished debugging
                    }
                }
            }
        }
    }

    torso1 = categorizedTemplateList["FemaleTorso"]["Bijin Skin 4K CBBE Elder Only (For use alongside Demoniac)"][0];
    torso2 = categorizedTemplateList["FemaleTorso"]["Bijin Skin 4K CBBE Elder Only (For use alongside Demoniac)"][1];

    etc1 = torso1["Female world model"]["MO3S - Alternate Textures"][0]["New Texture"];
    etc2 = torso2["Female world model"]["MO3S - Alternate Textures"][0]["New Texture"];

    let debugEqual = angular.equals(etc1, etc2);

    //categorizedTemplateList["SkinFemaleEtc"]["Bijin Skin 4K CBBE Elder Only (For use alongside Demoniac)"][0].test = "testing";
    let stop;
}

function linkUniqueSubRecords(obj, categorizedTemplateList, sourceAssetPack, debugObj) //
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
                    linkUniqueSubRecords(value[i], categorizedTemplateList, sourceAssetPack, debugObj);
                }
                else if (value[i].zEBDUniqueID !== undefined)
                {
                    linkRecordValueToUniqueList(value[i], categorizedTemplateList[value[i].zEBDUniqueID][sourceAssetPack], sourceAssetPack);
                }
            }
        }

        else if (Aux.isObject(value) && value.zEBDUniqueID === undefined)
        {
            linkUniqueSubRecords(value, categorizedTemplateList, sourceAssetPack, debugObj);
        }

        else if (value.zEBDUniqueID !== undefined)
        {
            linkRecordValueToUniqueList(value, categorizedTemplateList[value.zEBDUniqueID][sourceAssetPack], sourceAssetPack);
            //index = getRecordIndexInList(value, categorizedTemplateList[value.zEBDUniqueID][sourceAssetPack], debugObj);
            //value.$zEBDLinkTo = {"zEBDUniqueID": value.zEBDUniqueID, "sourceAssetPack": sourceAssetPack, "index": index};
        }
    }
}

function linkRecordValueToUniqueList(record, list, sourceAssetPack)
{
    for (let i = 0; i < list.length; i++)
    {
        //if (angular.equals(record, list[i]) === true)
        //debug
        //let stringA = JSON.stringify(record, hidezEBDLinkTo);
        //let stringB = JSON.stringify(list[i], hidezEBDLinkTo);
        //
        //if (JSON.stringify(record, hidezEBDLinkTo) === JSON.stringify(list[i], hidezEBDLinkTo)) // need to hide the "$zEBDLinkTo" property because if list[i] has already received the $zEBDLinkTo key while record has not, the comparison will return false
        //if (bzEBDRecordTemplatesEquivalent(record, list[i]) === true) SLOW
        if (angular.equals(record, list[i]))
        {
            //return i;
            record.$zEBDLinkTo = {"zEBDUniqueID": record.zEBDUniqueID, "sourceAssetPack": sourceAssetPack, "index": i};
        }
    }
}

function getRecordIndexInList(record, list)
{
    for (let i = 0; i < list.length; i++)
    {
        //if (angular.equals(record, list[i]) === true)
        //debug
        //let stringA = JSON.stringify(record, hidezEBDLinkTo);
        //let stringB = JSON.stringify(list[i], hidezEBDLinkTo);
        //
        //if (JSON.stringify(record, hidezEBDLinkTo) === JSON.stringify(list[i], hidezEBDLinkTo)) // need to hide the "$zEBDLinkTo" property because if list[i] has already received the $zEBDLinkTo key while record has not, the comparison will return false
        if (angular.equals(record, list[i]))
        {
            return i;
        }
    }
    return -1;
}



// End Generate Unique Records Code Block

function categorizeUniqueRecordList(recordList, categorizedList)
{
    for (let i = 0; i < recordList.length; i++)
    {
        // push an object consisting of {record, index of record}. Note: Index is used to record position in the unique record list, which is used by IO.loadGeneratedPermutations_Records()
        // adding the index as a property of the record is not suitable because it breaks the comparison of the recordTemplates in this list vs. those attached to permutations (which would not have this property) using angular.equals or json.stringify
        categorizedList[recordList[i].zEBDUniqueID][recordList[i].zEBDsourceAssetPack].push({"record": recordList[i], "index": i}); 
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
                        categorizedSubList = categorizedTemplateList[value[i].zEBDUniqueID][value[i].zEBDsourceAssetPack];
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
                    categorizedSubList = categorizedTemplateList[value.zEBDUniqueID][value.zEBDsourceAssetPack];
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

// this function sets the priority (depth) of the given record
// returns the maximum depth reached in record and its subrecords
// records themselves are updated by reference
/*
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
*/
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

function initializeFilledTemplateList(assetPackSettings)
{
    let filledList = {};
    for (let i = 0; i < assetPackSettings.length; i++)
    {
        filledList[assetPackSettings[i].groupName] = [];
    }
    return filledList;
}

function initializeCategorizedTemplateList(assetPackSettings, recordTemplates)
{
    let UniqueIDlist = [];
    for (let i = 0; i < recordTemplates.length; i++)
    {
        Aux.getAllValuesInObject(recordTemplates[i], UniqueIDlist, "zEBDUniqueID");
    }
    UniqueIDlist = Aux.getArrayUniques(UniqueIDlist);

    let categorizedTemplateList = {};

    for (let i = 0; i < UniqueIDlist.length; i++)
    {
        categorizedTemplateList[UniqueIDlist[i]] = {};
        for (let j = 0; j < assetPackSettings.length; j++)
        {
            categorizedTemplateList[UniqueIDlist[i]][assetPackSettings[j].groupName] = [];
        }
    }

    return categorizedTemplateList;
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

    let tmpPathStorageObj = {};
    let pathMapping = {};
    for (let i = 0; i < paths.length; i++)
    {
        pathMapping[paths[i]] = [];
        for (let j = 0; j < recordTemplates.length; j++)
        {
            tmpPathStorageObj = {"EDID": recordTemplates[j].zEBDUniqueID};
            getGlobalPathFromObjectTemplate(paths[i], recordTemplates[j], tmpPathStorageObj, "");
            if (tmpPathStorageObj.totalPath !== undefined)
            {
                pathMapping[paths[i]].push({"relativePath": tmpPathStorageObj.totalPath.substring(1), "zEBDUniqueID": recordTemplates[j].zEBDUniqueID}); // substring to cut off leading '\'
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

function bzEBDRecordTemplatesEquivalent(rtA, rtB)
{
    if (JSON.stringify(rtA, hidezEBDLinkTo) === JSON.stringify(rtB, hidezEBDLinkTo))
    {
        return true;
    }
    else
    {
        return false;
    }
}

function hidezEBDLinkTo(key,value)
{
    if (key=="$zEBDLinkTo") return undefined;
    else return value;
}

/* inclomplete; reverting to angular.equals
function deepCompareA(A, B, excludedProps)
{
    // check # keys
    let Bkeys = Object.keys(B);
    if (Object.keys(A).length !== Bkeys.length)
    {
        return false;
    }
    
    let attributesCompared = [];
    for (let [attribute, value] of Object.entries(A))
    {
        if (excludedProps.includes(attribute))
        {
            continue;
        }
        else if (Bkeys.includes(attribute) === false)
        {
            return false;
        }
        
        if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                
            }
        }
        else if (Aux.isObject(value))
        {

        }
        else
        {
            
        }
    }
    return true;
}*/