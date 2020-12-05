let Aux = require('./Auxilliary.js');

module.exports = function(logDir, fh, xelib)
{
    let PO = {};

    PO.getNPCinfo = function(NPCrecordHandle, consistencyRecords, settings, xelib)
    {
        let NPCinfo = {};

        NPCinfo.name = xelib.FullName(NPCrecordHandle);
        NPCinfo.formID = xelib.GetHexFormID(NPCrecordHandle);
        NPCinfo.formIDSignature = Aux.generateFormIDsignature(NPCinfo.formID);
        NPCinfo.EDID = xelib.EditorID(NPCrecordHandle);
        NPCinfo.rootPlugin = xelib.GetFileName(xelib.GetElementFile(xelib.GetMasterRecord(NPCrecordHandle)));
        NPCinfo.race = xelib.GetRefEditorID(NPCrecordHandle, 'RNAM');
        NPCinfo.isUnique = xelib.GetIsUnique(NPCrecordHandle);
        NPCinfo.gender = "male";
        if (xelib.GetIsFemale(NPCrecordHandle) === true)
        {
            NPCinfo.gender = "female";
        }
        NPCinfo.height = xelib.GetValue(NPCrecordHandle, "NAM6 - Height"); // keep as string because zEBD edits this value, and xelib expects string
        NPCinfo.weight = parseFloat(xelib.GetValue(NPCrecordHandle, "NAM7 - Weight")); // convert to float because zEBD does not edit this value, and no reason to perform the conversion multiple times

        NPCinfo.consistencyIndex = findNPCAssignmentIndex(consistencyRecords, NPCinfo);

        NPCinfo.origRace = NPCinfo.race; // to support aliasing

        NPCinfo.bForceVerboseLogging = bVerboseForcedForCurrentNPC(NPCinfo, settings.verboseMode_NPClist);

        return NPCinfo;
    }

    PO.getUserForcedAssignment = function(NPCinfo, forcedNPCAssignments, linkedNPCgroup, assetPackSettings)
    {
        let NPCforcedAssetsIndex = findNPCfromInfo(forcedNPCAssignments, NPCinfo);// for user-assigned subgroup IDs
        let forcedNPC = forcedNPCAssignments[NPCforcedAssetsIndex];

        // get forced assignments from linked NPCs
        if (linkedNPCgroup !== undefined)
        {
            let linkedNPC = {};
            
            // get forced asset pack and subgroups
            if (linkedNPCgroup.hasForcedAssetPack === undefined)
            {
                //look through linked NPCs for asset packs and subgroups to force
                for (let i = 0; i < linkedNPCgroup.NPCs.length; i++)
                {
                    NPCforcedAssetsIndex = findNPCfromInfo(forcedNPCAssignments, linkedNPCgroup.NPCs[i]);
                    if (NPCforcedAssetsIndex >= 0)
                    {
                        linkedNPC = forcedNPCAssignments[NPCforcedAssetsIndex];

                        // if no asset pack for the linked group has yet been defined, set the asset pack for the link group, from the first member of the link group that has a forced asset pack
                        if (linkedNPC !== undefined && linkedNPC.forcedAssetPack !== undefined && linkedNPC.forcedAssetPack !== "" && linkedNPCgroup.forcedAssetPack === undefined) 
                        {
                            linkedNPCgroup.forcedAssetPack = linkedNPC.forcedAssetPack;
                            linkedNPCgroup.forcedSubgroups = linkedNPC.forcedSubgroups;
                        }

                        // if an asset pack has been defined for the link group, check other linked NPCs and add their forced subgroups if they come from the same asset pack
                        else if (linkedNPC !== undefined && linkedNPC !== undefined && linkedNPC.forcedSubgroups !== undefined && linkedNPC.forcedSubgroups.length > 0 && linkedNPC.forcedAssetPack === linkedNPCgroup.forcedAssetPack) 
                        {
                            for (let j = 0; j < linkedNPC.forcedSubgroups.length; j++)
                            {
                                linkedNPCgroup.forcedSubgroups.push(linkedNPC.forcedSubgroups[j]);
                            }
                        }
                    }
                }

                // if no forced asset pack was found for any linked NPCs, set it to false to avoid repeating the search for future NPCs
                if (linkedNPCgroup.forcedAssetPack === undefined)
                {
                    linkedNPCgroup.hasForcedAssetPack = false;
                }
                else
                {
                    linkedNPCgroup.hasForcedAssetPack = true;
                }
            }

            // get forced height
            if (linkedNPCgroup.hasForcedHeight === undefined)
            {
                //look through linked NPCs for heights to force
                for (let i = 0; i < linkedNPCgroup.NPCs.length; i++)
                {
                    NPCforcedAssetsIndex = findNPCfromInfo(forcedNPCAssignments, linkedNPCgroup.NPCs[i]);
                    if (NPCforcedAssetsIndex >= 0)
                    {
                        linkedNPC = forcedNPCAssignments[NPCforcedAssetsIndex];
                        
                        if (linkedNPC.forcedHeight !== undefined && linkedNPC.forcedHeight !== "")
                        {
                            linkedNPCgroup.forcedHeight = linkedNPC.forcedHeight;
                            break;
                        }
                    }
                }

                // if no forced height was found for any linked NPCs, set it to false to avoid repeating the search for future NPCs
                if (linkedNPCgroup.forcedHeight === undefined)
                {
                    linkedNPCgroup.hasForcedHeight = false;
                }
                else
                {
                    linkedNPCgroup.hasForcedHeight = true;
                }
            }

            // get forced BodyGen
            if (linkedNPCgroup.hasForcedBodyGenMorphs === undefined)
            {
                //look through linked NPCs for morphs to force
                for (let i = 0; i < linkedNPCgroup.NPCs.length; i++)
                {
                    NPCforcedAssetsIndex = findNPCfromInfo(forcedNPCAssignments, linkedNPCgroup.NPCs[i]);
                    if (NPCforcedAssetsIndex >= 0)
                    {
                        linkedNPC = forcedNPCAssignments[NPCforcedAssetsIndex];
                        
                        if (linkedNPC.forcedBodyGenMorphs !== undefined && linkedNPC.forcedBodyGenMorphs.length > 0)
                        {
                            linkedNPCgroup.forcedBodyGenMorphs = linkedNPC.forcedBodyGenMorphs;
                            break;
                        }
                    }
                }

                // if no forced bodygen was found for any linked NPCs, set it to false to avoid repeating the search for future NPCs
                if (linkedNPCgroup.forcedBodyGenMorphs === undefined)
                {
                    linkedNPCgroup.hasForcedBodyGenMorphs = false;
                }
                else
                {
                    linkedNPCgroup.hasForcedBodyGenMorphs = true;
                }
            }

            // assigned forced data if it is found from linked NPCs

            // create a force list entry for current NPC if it doesn't exist
            if (forcedNPC === undefined && (linkedNPCgroup.hasForcedAssetPack === true || linkedNPCgroup.hasForcedHeight === true || linkedNPCgroup.hasForcedBodyGenMorphs === true))
            {
                forcedNPC = Aux.createForcedNPC(NPCinfo);
            }
            
            if (linkedNPCgroup.hasForcedAssetPack === true)
            {
                forcedNPC.forcedAssetPack = linkedNPCgroup.forcedAssetPack;
                forcedNPC.forcedSubgroups = linkedNPCgroup.forcedSubgroups;
            }

            if (linkedNPCgroup.hasForcedHeight === true)
            {
                forcedNPC.forcedHeight = linkedNPCgroup.forcedHeight;
            }

            if (linkedNPCgroup.hasForcedBodyGenMorphs === true)
            {
                forcedNPC.forcedBodyGenMorphs = linkedNPCgroup.forcedBodyGenMorphs;
            }
        }

        // get the top-level indices of forced subgroups
        if (forcedNPC !== undefined && forcedNPC.forcedSubgroups !== undefined)
        {
            let forcedAssetPack = {};
            for (let i = 0; i < assetPackSettings.length; i++)
            {
                if (assetPackSettings[i].groupName === forcedNPC.forcedAssetPack)
                {
                    forcedAssetPack = assetPackSettings[i];
                    break;
                }
            }

            for (let i = 0; i < forcedNPC.forcedSubgroups.length; i++)
            {
                let bMatched = false;
                for (let j = 0; j < forcedAssetPack.flattenedSubgroups.length; j++)
                {
                    for (let k = 0; k < forcedAssetPack.flattenedSubgroups[j].length; k++)
                    {
                        if (forcedNPC.forcedSubgroups[i].id === forcedAssetPack.flattenedSubgroups[j][k].id)
                        {
                            forcedNPC.forcedSubgroups[i].topLevelIndex = j;
                            bMatched = true;
                            break;
                        }
                    }
                    if (bMatched === true)
                    {
                        break;
                    }
                }
            }
        }

        return forcedNPC;
    }

    PO.getBlocks = function(NPCrecord, blockList, NPCinfo, logMessage, xelib)
    {
        let BlockedNPCs = blockList.blockedNPCs;
        let BlockedPlugins = blockList.blockedPlugins;
        let blockListIndex = findNPCfromInfo(BlockedNPCs, NPCinfo); // block list is same format as ForcedList, so using same search function

        let blockInfo = {};
        blockInfo.assets = false;
        blockInfo.height = false;
        blockInfo.bodygen = false;
        let writeString = "";

        // silent hardcoded blocks
        let bHardCodedBlock = false;
        if (NPCinfo.EDID === "AAEMTindra") // list NPCs that should be hard blocked here. 
        {
            // Tindra is set to NordRace for some reason. Definitely did not expect to find her in my consistency file. Add other NPCs to the condition above if similar situations arise.
            bHardCodedBlock = true;
        }

        if (bHardCodedBlock === true)
        {
            blockInfo.assets = true;
            blockInfo.height = true;
            blockInfo.bodygen = true;
            return blockInfo;
        }

        // block by ID
        if (blockListIndex >= 0)
        {
            writeString += "NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked by ID from: " 
            if (BlockedNPCs[blockListIndex].bBlockAssets === true)
            {
                blockInfo.assets = true;
                writeString += "Assets "
            }

            if (BlockedNPCs[blockListIndex].bBlockHeight === true)
            {
                blockInfo.height = true;
                writeString += "Height "
            }

            if (BlockedNPCs[blockListIndex].bBlockBodyGen === true)
            {
                blockInfo.bodygen = true;
                writeString += "BodyGen"
            }            
        }

        if (writeString !== "")
        {
            logMessage(writeString);
            writeString = "";
        }

        // block by Plugin
        let overrides = xelib.GetOverrides(NPCrecord);
        let ORfileName = "";
        let blockedPlugin;

        for (let i = 0; i < BlockedPlugins.length; i++)
        {
            if (NPCinfo.rootPlugin === BlockedPlugins[i].name)
            {
                blockedPlugin = BlockedPlugins[i];
                break;
            }
            else
            {
                for (let j = 0; j < overrides.length; j++)
                {
                    ORfileName = xelib.GetFileName(xelib.GetElementFile(overrides[j]));
                    if (ORfileName === BlockedPlugins[i].name)
                    {
                        blockedPlugin = BlockedPlugins[i];
                        break;
                    }
                }
            }
        }

        if (blockedPlugin !== undefined)
        {
            writeString += "NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked by Plugin (" + ORfileName + ") from: "
            if (blockedPlugin.bBlockAssets === true)
            {
                blockInfo.assets = true;
                writeString += "Assets "
            }

            if (blockedPlugin.bBlockHeight === true)
            {
                blockInfo.height = true;
                writeString += "Height "
            }

            if (blockedPlugin.bBlockBodyGen === true)
            {
                blockInfo.bodygen = true;
                writeString += "BodyGen"
            }     
        }

        if (writeString !== "")
        {
            logMessage(writeString);
        }

        return blockInfo;
    };

    PO.findNPCinLinkedList = function(linkedNPCList, NPCinfo)
    {
        for (let i = 0; i < linkedNPCList.length; i++)
        {
            for (let j = 0; j < linkedNPCList[i].NPCs.length; j++)
            {
                if (NPCinfo.EDID === linkedNPCList[i].NPCs[j].EDID && NPCinfo.formIDSignature === Aux.generateFormIDsignature(linkedNPCList[i].NPCs[j].formID))
                {
                    return linkedNPCList[i];
                }
            }
        }
    }

    PO.writePermutationRecords = function(recordsToWrite, patchFile, RNAMdict, maxPriority, xelib, patchableRaces, EDIDarray, writtenRecordNames)
    {
        let basePath = "";
        let currentRecordHandle;

        for (let i = maxPriority; i >= 0; i--)
        {
            for (let j = 0; j < recordsToWrite.length; j++)
            {
                if (recordsToWrite[j].zEBDpriority === i)
                {
                    basePath = recordsToWrite[j].zEBDSignature + "\\" + recordsToWrite[j].zEBDSignature;
                    currentRecordHandle = xelib.AddElement(patchFile, basePath);
                    writeTemplateToRecord(recordsToWrite[j], currentRecordHandle, xelib, "", EDIDarray, patchableRaces, RNAMdict);

                    // log the written record
                    writtenRecordNames.push(recordsToWrite[j].EDID + " (" + recordsToWrite[j].zEBDformID + ")");
                    // remove the written record from the write list so that if another NPC is assigned the same permutation, these records don't get rewritten
                    recordsToWrite.splice(j, 1);
                    j--;
                    //
                }
            }
        }
    }

    PO.applyPermutation = function(NPCrecordHandle, permutation, formIDdict, bUpdateHeadPartNames, xelib, copyToPatch)
    {
        let keywordFormID = "";

        for (let i = 0; i < permutation.templates.length; i++)
        {
            if (permutation.templates[i].zEBDPositionisArray === true)
            {
                xelib.AddElementValue(NPCrecordHandle, permutation.templates[i].zEBDPosition + "\\.", permutation.templates[i].zEBDformID);
            }

            else
            {
                xelib.AddElementValue(NPCrecordHandle, permutation.templates[i].zEBDPosition, permutation.templates[i].zEBDformID);
            }
        }

        for (let i = 0; i < permutation.addKeywords.length; i++)
        {
            keywordFormID = formIDdict[permutation.addKeywords[i]];
            xelib.AddArrayItem(NPCrecordHandle, "KWDA - Keywords", "", keywordFormID);
        }

        if (bUpdateHeadPartNames === true)
        {
            validateFaceParts(NPCrecordHandle, xelib, copyToPatch);
        }
    };

    PO.generateRaceEDIDFormIDdict = function(loadRecords, dict)
    {
        let EDID = "";
        let formID = "";

        let raceHandles = loadRecords('RACE');

        for (let i = 0; i < raceHandles.length; i++)
        {
            EDID = xelib.EditorID(raceHandles[i]);
            formID = xelib.GetHexFormID(raceHandles[i]);

            dict[EDID] = formID;
            dict[formID] = EDID;

            if (dict.allEDIDs.includes(EDID) === false)
            {
                dict.allEDIDs.push(EDID);
            }
            if (dict.allFormIDs.includes(formID) === false)
            {
                dict.allFormIDs.push(formID);
            }
        }

        return dict;
    };

    return PO;
};

function writeTemplateToRecord(recordTemplate, recordHandle, xelib, prependPath, EDIDarray, patchableRaces, RNAMdict)
{
    let prependPathOrig = prependPath;
    let tmpHandle;
    let writeLoc = "";

    for (let [element, value] of Object.entries(recordTemplate)) // iterate through each element of the record
    {
        if (Number.isInteger(element) === true) // check if this conversion is needed since the array section is already sending the index as "\[n]\".
        {
            element = "[" + element.toString() + "]"; // convert array index to xEdit format
        }

        if (value.zEBDformID !== undefined) // If the element's value points to another recordTemplate, insert that template's formID, which should already have been assigned.
        {
            // Since recordTemplates are written to the plugin in order of priority (depth), templates that don't reference other templates are written first          
            xelib.AddElementValue(recordHandle, prependPath + element, value.zEBDformID); // After being written they are assigned a formID, so this should never be undefined
        }

        else if (element === "zEBDAddValidRaces") // value will be an array of paths to which the current recordTemplate's valid races should be added
        {
            for (let i = 0; i < value.length; i++)
            {
                writeLoc = value[i];
                for (let j = 0; j < patchableRaces.length; j++)
                {
                    if (RNAMdict[patchableRaces[j]] !== undefined)
                    {
                        xelib.AddArrayItem(recordHandle, prependPath +  writeLoc,"",  RNAMdict[patchableRaces[j]]);
                    }
                }
            }
        }

        else if (element.indexOf("zEBD") === 0 || element.indexOf("$zEBD") === 0) { continue; } // if the element is a reserved zEBD value, don't write it to the plugin.

        else if (Aux.isObject(value) === true && value.zEBDformID === undefined) // if the value is an object (including array) but not an zEBD Record itself | Note that an array of flags will also be an object, so handle flags here
        {
            tmpHandle = xelib.AddElement(recordHandle, prependPath + element); // required to call IsFlags
            if (xelib.IsFlags(tmpHandle) === true) // if element points to
            {
                xelib.SetEnabledFlags(recordHandle, prependPath + element, value);
            }

            else if (Array.isArray(value) === true) // if the element value is an array
            {
                for (let i = 0; i < value.length; i++) // iterate through each array element
                {
                    if (value[i].zEBDformID != undefined) // if the array element's value points to another recordTemplate, push that template's formID to the array
                    {
                        if (i === 0)
                        {
                            xelib.RemoveElement(recordHandle, prependPath + element); // removes a null reference generated by the "tmpHandle = xelib.AddElement(recordHandle, prependPath + element);" call above. However, RemoveElement should not be called if the array elements are structs rather than records, because then AddArrayItem will throw an error.
                        }

                        xelib.AddArrayItem(recordHandle, prependPath + element, "", value[i].zEBDformID);
                    }
                    else // if the array's element value is a not another recordTemplate, recursively run this function on the value
                    {
                        if (Aux.isObject(value[i]) === false)
                        {
                            xelib.AddArrayItem(recordHandle, prependPath + element, "", value[i]);
                        }
                        else
                        {
                            xelib.AddArrayItem(recordHandle, prependPath + element, '', '');
                            writeTemplateToRecord(value[i], recordHandle, xelib, prependPath + element + "\\[" + i.toString() + "]\\", EDIDarray, patchableRaces, RNAMdict); // recursion here
                        }
                    }
                }
            }

            else // if the element is an object but not an array, prepend the element's path and recurse function to that element's value.
            {
                prependPath += element + "\\";
                writeTemplateToRecord(value, recordHandle, xelib, prependPath, EDIDarray, patchableRaces, RNAMdict); // recursion here
                prependPath = prependPathOrig; // revert prependPath back to what it was in this
            }
        }

        else // if the element is not another zEBD record, and is not an object, and is not a reserved value, set its value to that defined in the JSON file
        {
            if (element === "EDID")
            {
                value = updateEDIDCount(value, EDIDarray); // differentiate EditorIDs by assigning them a number in order of appearance
                recordTemplate["EDID"] = value; // value seems to be a new object in memory, so updating it does not update the recordTemplate. Forcing the update here (so that it's accessible to subsequent logging functions).
            }
            if (!(typeof value === 'string' || value instanceof String)) { value = value.toString(); } // convert numbers to strings

            xelib.AddElementValue(recordHandle, prependPath + element, value);
        }
    }

    if (prependPath === "") // if this is the first recursion, set the formID.
    {
        recordTemplate.zEBDformID = xelib.GetHexFormID(recordHandle);
    }
}

// renames the EDID based on its count.
function updateEDIDCount(EDID, EDIDarray)
{
    let counter = 1;
    let newEDID = "";

    for (let i = 0; i < EDIDarray.length; i++)
    {
        if (EDIDarray[i].indexOf(EDID) === 0)
        {
            counter++;
        }
    }

    newEDID = EDID + counter.toString();

    EDIDarray.push(EDID);
    return newEDID;
}

// this function finds the given NPC within the consistency record
function findNPCAssignmentIndex(consistencyRecords, NPCinfo)
{
    let index = -1;

    for (let i = 0; i < consistencyRecords.length; i++)
    {
        if (consistencyRecords[i].rootPlugin === NPCinfo.rootPlugin && consistencyRecords[i].formIDSignature === NPCinfo.formIDSignature)
        {
            index = i;
            break;
        }
    }
    return index;
}

// finds the index of a given NPC in either the ForceList or the BlockList
// Note that if both a formID and a master plugin name were provided, the formID is already validated and updated - no need to recheck.
function findNPCfromInfo(NPCList, NPCinfo)
{
    let index = -1;
    if (NPCList === undefined || NPCList.length === 0) { return  -1; }
    
    // priority: formID, EDID, name, rootPlugin
    for (let i = 0; i < NPCList.length; i++)
    {
        if (NPCList[i].rootPlugin === NPCinfo.rootPlugin && NPCinfo.formIDSignature === Aux.generateFormIDsignature(NPCList[i].formID))
        {
            return i;
        }       
    }
    
    return index;
}

// EBD script has a bug/feature where if an NPC has a headpart whose EDID != its Full Name, it won't be updated by the face script
// This function aims to circumvent this by changing the Full Name to the EditorID
function validateFaceParts(NPCrecordHandle, xelib, copyToPatch)
{
    let hasHeadParts = xelib.HasElement(NPCrecordHandle, "Head Parts");
    let headParts = [];
    let currentHeadPartHandle;
    let newHeadPartHandle;
    let EDID = "";
    let FullName = "";

    if (hasHeadParts === true)
    {
        headParts = xelib.GetElements(NPCrecordHandle, "Head Parts");
        for (let i = 0; i < headParts.length; i++)
        {
            EDID = "";
            FullName = "";
            currentHeadPartHandle = xelib.GetLinksTo(NPCrecordHandle, "Head Parts\\[" + i.toString() + "]");

            if (xelib.HasElement(currentHeadPartHandle, "EDID"))
            {
                EDID = xelib.EditorID(currentHeadPartHandle);
            }

            if (xelib.HasElement(currentHeadPartHandle, "FULL - Name"))
            {
                FullName = xelib.FullName(currentHeadPartHandle);
            }

            if (EDID !== FullName)
            {
                
                newHeadPartHandle = copyToPatch(currentHeadPartHandle, false);
                xelib.AddElementValue(newHeadPartHandle, "FULL - Name", EDID);
            }
        }
    }
}

function bVerboseForcedForCurrentNPC(NPCinfo, verboseMode_NPClist)
{
    for (let i = 0; i < verboseMode_NPClist.length; i++)
    {
        if (verboseMode_NPClist[i].formIDSignature === NPCinfo.formIDSignature && verboseMode_NPClist[i].rootPlugin === NPCinfo.rootPlugin)
        {
            return true;
        }
    }
    return false;
}
