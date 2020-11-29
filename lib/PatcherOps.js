debugger;
let Aux = require('./Auxilliary.js');
let BGI = require('./BodyGenIntegration.js')(Aux);
let PG = require('./PermutationGenerator.js')();

module.exports = function(logDir, fh, xelib)
{
    let PO = {};

    PO.writePermutationRecords = function(recordsToWrite, patchFile, RNAMdict, maxPriority, xelib, patchableRaces, EDIDarray)
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

                    // remove the written record from the write list so that if another NPC is assigned the same permutation, these records don't get rewritten
                    recordsToWrite.splice(j, 1);
                    j--;
                    //
                }
            }
        }
    }

    PO.writeAssets = function(assetRecords, patchFile, logMessage, patchableRaces, RNAMdict)
    {
        let maxPriority = assetRecords.maxPriority;
        let categorizedRecords = assetRecords.recordTemplates;
        let currentRecordHandle;
        let recordCounter = 0;
        let basePath = "";
        let EDIDarray = [];

        for (let i = maxPriority; i >= 0; i--)
        {
            counter = 0;
            for (let [zEBDUniqueID, sublistA] of Object.entries(categorizedRecords))
            {
                for (let [sourceAssetPack, sublistB] of Object.entries(sublistA))
                {
                    if (sublistB.length > 0 && sublistB[0].zEBDpriority === i)
                    {
                        for (let j = 0; j < sublistB.length; j++)
                        {
                            recordCounter++;
                            counter++;
                            basePath = sublistB[j].zEBDSignature + "\\" + sublistB[j].zEBDSignature;
                            currentRecordHandle = xelib.AddElement(patchFile, basePath);
                            writeTemplateToRecord(sublistB[j], currentRecordHandle, xelib, "", EDIDarray, patchableRaces, RNAMdict, categorizedRecords);
                            if (recordCounter % 100 === 0) { logMessage("Wrote " + recordCounter + " new records")}
                        }
                    }
                }
            }
        }
        logMessage("Wrote " + recordCounter + " new records");
    }

    PO.getNPCinfo = function(NPCrecordHandle, consistencyRecords, xelib)
    {
        let NPCinfo = {};

        NPCinfo.name = xelib.FullName(NPCrecordHandle);
        NPCinfo.formID = xelib.GetHexFormID(NPCrecordHandle);
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

    PO.findNPCinLinkedList = function(linkedNPCList, NPCinfo)
    {
        for (let i = 0; i < linkedNPCList.length; i++)
        {
            for (let j = 0; j < linkedNPCList[i].NPCs.length; j++)
            {
                if (NPCinfo.EDID === linkedNPCList[i].NPCs[j].EDID && NPCinfo.formID.substring(2,9) === linkedNPCList[i].NPCs[j].formID.substring(2,9))
                {
                    return linkedNPCList[i];
                }
            }
        }
    }

    PO.assignNPCheight = function(NPCrecordHandle, NPCinfo, bEnableConsistency, consistencyRecords, heightSettings, userForcedAssignment, bChangeNonDefaultHeight, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCheights, NPClinkGroup, aliasList, logMessage)
    {
        let lowerBound;
        let upperBound;
        let range;
        let height;
        let heightString;
        let bGenerateRandom = true;
        let currentHeightSettings;
        let bHeightForced = false;

        // if NPC belongs to a link group and the height for the group has already been assigned, use the height from the link group
        if (NPClinkGroup !== undefined && NPClinkGroup.height !== undefined)
        {
            heightString = NPClinkGroup.height;
            bGenerateRandom = false;
            bHeightForced = true;
        }

        // if NPC does belong to link group and NPC assignments are linked by name, check if the current NPC has already been matched in the generic linkage list and return its height if so
        if (NPClinkGroup === undefined && bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            heightString = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCheights)
            if (heightString != undefined)
            {
                bGenerateRandom = false;
                bHeightForced = true;
            }
        }

        // alias NPC as needed
        Aux.setAliasRace(NPCinfo, aliasList, "height");

        if (userForcedAssignment !== undefined && userForcedAssignment.forcedHeight !== undefined && userForcedAssignment.forcedHeight !== "")
        {
            bGenerateRandom = false;
            heightString = parseFloat(userForcedAssignment.forcedHeight).toFixed(6);
            bHeightForced = true;
        }

        else if (bChangeNonDefaultHeight === false && NPCinfo.height !== "1.000000")
        {
            bGenerateRandom = false;
            heightString = NPCinfo.height;
            bHeightForced = true;
        }

        // find settings for current NPC race
        for (let i = 0; i < heightSettings.length; i++)
        {
            if (heightSettings[i].EDID === NPCinfo.race)
            {
                currentHeightSettings = heightSettings[i];
                break;
            }
        }
        
        // return if race is not found
        if (currentHeightSettings === undefined)
        {
            Aux.revertAliasRace(NPCinfo);
            return;
        }

        // get gender-specific settings
        switch(NPCinfo.gender)
        {
            case "male":
                range = parseFloat(currentHeightSettings.heightMaleRange);
                break;
            case "female":
                range = parseFloat(currentHeightSettings.heightFemaleRange);
                break;
        }

        // reminder: The bounds should be centered around 1, not around currentHeightSettings.heightMale/Female. heightMale/Female gets applied to the RACE record, not the NPC_ record.
        lowerBound = 1 - range;
        upperBound = 1 + range;

        // consistency
        // most of the following conditions should never be hit, but could arise if the user manually edits the consistency file
        if (bEnableConsistency === true && NPCinfo.consistencyIndex >= 0 && consistencyRecords[NPCinfo.consistencyIndex].height !== undefined && consistencyRecords[NPCinfo.consistencyIndex].height !== "" && bHeightForced === false)
        {
            bGenerateRandom = false;
            heightString = consistencyRecords[NPCinfo.consistencyIndex].height;
            height = parseFloat(heightString);

            // validate to make sure settings haven't changed since last run
            if (height < lowerBound || height > upperBound)
            {
                logMessage("Consistency height for NPC "+ NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") is not allowed by current settings. Assigning a random height.");
                bGenerateRandom = true;
            }
        }
        
        // random generation
        if (bGenerateRandom === true)
        {
            switch(currentHeightSettings.distMode)
            {
                case "uniform": 
                    height = generateRandomNumber_Uniform(lowerBound, upperBound);                       
                    break;

                case "bell curve":
                    height = generateRandomNumber_Gaussian(lowerBound, upperBound);
                    break;
            }

            heightString = height.toFixed(6);
        }

        if (bEnableConsistency === true)
        {
            if (NPCinfo.consistencyIndex === -1) // if no record of this NPC exists in the consistency file, create one
            {
                Aux.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib);
            }

            updateHeightConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], heightString);
        }

        Aux.updatelinkedDataArray(bLinkNPCsWithSameName, NPCinfo, heightString, LinkedNPCNameExclusions, linkedNPCheights);

        if (NPClinkGroup !== undefined && NPClinkGroup.height === undefined)
        {
            NPClinkGroup.height = heightString;
        }

        Aux.revertAliasRace(NPCinfo);
        return heightString;
    }

    PO.patchRaceHeight = function(raceRecordHandle, raceEDID, heightConfiguration)
    {
        for (let i = 0; i < heightConfiguration.length; i++)
        {
            if (heightConfiguration[i].EDID === raceEDID)
            {
                xelib.SetValue(raceRecordHandle, "DATA\\Male Height", heightConfiguration[i].heightMale);
				xelib.SetValue(raceRecordHandle, "DATA\\Female Height", heightConfiguration[i].heightFemale);
            }
        }
    }

    PO.choosePermutation_BodyGen = function(NPCrecordHandle, NPCinfo, permutations, assetPackSettings, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, consistencyRecords, bEnableConsistency, bEnableBodyGenIntegration, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCpermutations, linkedNPCbodygen, NPClinkGroup, aliasList, attributeCache, logMessage)
    {
        let bAllowOtherRGCombos = false; // keep false for now until making option in GUI. True significantly increases computation time. Variable allows forceIfAttributes and forcedSubgroups to look into permutations restricted to NPCs of a race and gender different from that of current NPC
        let bAssetsForcedByUser = false;                // for matching specific user-assigned subgroup IDs to NPCs
        let bNPCfoundInConsistencyRecords = false;      // for consistency
        let userForcedSubgroupsApplied = [];            // for matching specific user-assigned subgroup IDs to NPCs      
        let permutationToReturn = undefined;            // function output
        let assetPackSettings_Filtered = [];            // contains only those subgroups that are forced or allowed for the current NPC
        let failureModes = {};                          // for reporting to the user why a permutation couldn't be assigned.

        let bSkipSelection = false;                     // skip asset selection because the permutation has been pre-set by another NPC
        let bSkipRandomSelection = false;               // skip random asset selection if the permutation was found in consistency
        
        // matching current NPC to NPC-specific rules

        // if NPC belongs to a link group and the permutation for the group has already been assigned, use the permutation from the link group
        if (NPClinkGroup !== undefined && NPClinkGroup.permutation !== undefined && permutationAllowedByUserForceList(userForcedAssignment, NPClinkGroup.permutation) === true)
        {
            permutationToReturn = NPClinkGroup.permutation;
            bSkipSelection = true;
        }

        // if NPC assignments are linked by name, check if the current NPC has already been matched and use its permutation if so
        if (bSkipSelection === false && bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            permutationToReturn = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCpermutations)
            if (permutationToReturn != undefined && permutationAllowedByUserForceList(userForcedAssignment, permutationToReturn) === true)
            {
                bSkipSelection = true;
            }
        }

        // alias NPC as needed
        Aux.setAliasRace(NPCinfo, aliasList, "assets");

        if (bSkipSelection === false)
        {
            if (NPCinfo.consistencyIndex >= 0 && consistencyRecords[NPCinfo.consistencyIndex].assignedAssetPack !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedPermutation !== undefined)
            {
                bNPCfoundInConsistencyRecords = true;
            }
            if (userForcedAssignment !== undefined && userForcedAssignment.forcedAssetPack !== undefined && userForcedAssignment.forcedAssetPack !== "")
            {
                bAssetsForcedByUser = true;
                bAllowOtherRGCombos = true;
            }

            // new in 1.9
            assetPackSettings_Filtered = filterValidConfigsForNPC(NPCrecordHandle, NPCinfo, assetPackSettings, userForcedAssignment, NPCinfo, failureModes, xelib, logMessage, attributeCache) // filters by race, gender, allowed/disallowed attributes, and forced assignments
            
            // ForceIfAttributes - prune out permutations that aren't forced for this NPC, if the NPC has the given attribute
//FIX THIS LATER             filterPermutationsbyForceIfAttributes(NPCrecordHandle, userForcedSubgroupsApplied, NPCinfo, permutations, logMessage, xelib, attributeCache);
            // if ForceIf attributes applied, then ignore subgroup.distributionEnabled in bPermutationValidForCurrentNPC

            // CONSISTENCY:
//FIX THIS LATER            permutationToReturn = drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, userForcedSubgroupsApplied, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, aliasList, xelib, logMessage, attributeCache);
//FIX THIS LATER             if (permutationToReturn != undefined) 
//FIX THIS LATER             { 
//FIX THIS LATER                 bSkipRandomSelection = true;
//FIX THIS LATER             }
            
            // if consistency doesn't return a permutation, proceed below to generate randomly

            //RANDOM SELECTION
            if (bSkipRandomSelection === false)
            {
                permutationToReturn = chooseRandomPermutation(assetPackSettings_Filtered, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, userForcedSubgroupsApplied, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, failureModes, aliasList, xelib, logMessage, attributeCache);
            }
        }

        // Assign the chosen permutation to all relevant data lists
        if (permutationToReturn === undefined)
        {
            logMessage("\nAsset Assignment: no permutations satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). See zEBD\\Logs\\PermutationAssignmentFailures.txt for details.");
            //logMessage(Aux.formatFailureModeString(failureModes, "permutation"));
            permutationToReturn = undefined;          

            if (bEnableConsistency === true)
            {
                updatePermutationConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], permutationToReturn); // clears out the consistency
            }

            Aux.revertAliasRace(NPCinfo);
            return undefined;
        }
        else 
        {
            permutationToReturn = linkPermutationToUniques(permutationToReturn, permutations);
            permutationToReturn.NPCsAssignedTo.push("[" + NPCinfo.name + "|" + NPCinfo.EDID + "|" + NPCinfo.formID + "]"); // store for the permutation log
            Aux.updatelinkedDataArray(bLinkNPCsWithSameName, NPCinfo, permutationToReturn, LinkedNPCNameExclusions, linkedNPCpermutations) // store for linking same-named NPCs
            
            // store permutation for link group if it exists
            if (NPClinkGroup !== undefined && NPClinkGroup.permutation === undefined)
            {
                NPClinkGroup.permutation = permutationToReturn;
            }

            if (bEnableConsistency === true)
            {
                if (NPCinfo.consistencyIndex === -1) // if no record of this NPC exists in the consistency file, create one
                {
                    Aux.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib) // NPCinfo.consistencyIndex gets updated here
                } 
                updatePermutationConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], permutationToReturn);
            }   
        }

        Aux.revertAliasRace(NPCinfo);
        return permutationToReturn;
    };

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

    PO.generateAssetRaceGenderList = function(assetPackSettings, patchableRaces)
    {
        let patchableRGs = {};
        
        let currentGender;
        let bHasSpecifiedRaces = false;

        for (let i = 0; i < assetPackSettings.length; i++)
        {
            currentGender = assetPackSettings[i].gender;
            if (patchableRGs[currentGender] === undefined)
            {
                patchableRGs[currentGender] = [];
            }

            bHasSpecifiedRaces = false;
            for (let j = 0; j < assetPackSettings[i].flattenedSubgroups.length; j++)
            {
                for (let k = 0; k < assetPackSettings[i].flattenedSubgroups[j].length; k++)
                {
                    if (assetPackSettings[i].flattenedSubgroups[j][k].allowedRaces.length > 0)
                    {
                        bHasSpecifiedRaces = true;

                        for (let x = 0; x < assetPackSettings[i].flattenedSubgroups[j][k].allowedRaces.length; x++)
                        {
                            if (patchableRGs[currentGender].includes(assetPackSettings[i].flattenedSubgroups[j][k].allowedRaces[x]) === false)
                            {
                                patchableRGs[currentGender].push(assetPackSettings[i].flattenedSubgroups[j][k].allowedRaces[x]);
                            }
                        }
                    }
                }
            }
             // if the current asset pack has no specified races at all, add all patchable races
             if (bHasSpecifiedRaces === false)
             {
                 patchableRGs[currentGender] = patchableRaces;
             }
        }

        return patchableRGs;
    }

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

    return PO;
};

function filterValidConfigsForNPC(NPCrecordHandle, NPCinfo, assetPackSettings, userForcedAssignment, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let filtered = [];
    let tmp = {};
    let newSubgroup = {};
    let emptyFlag = false;
    let forcedAssetPack = "";
    let forcedSubgroups = {};

    // populated forcedSubgroups object with the subgrgroups forced by user (now categorized by index)
    if (userForcedAssignment !== undefined && userForcedAssignment.forcedSubgroups !== undefined && userForcedAssignment.forcedSubgroups.length > 0)
    {
        forcedAssetPack = userForcedAssignment.forcedAssetPack;
        for (let i = 0; i < userForcedAssignment.forcedSubgroups.length; i++)
        {
            if (forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex] === undefined)
            {
                forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex] = [];
            }

            forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex].push(userForcedAssignment.forcedSubgroups[i].id);
        }
    }

    // assemble filtered config files
    for (let i = 0; i < assetPackSettings.length; i++)
    {
        emptyFlag = false;

        // commented out the following code: non-forced config files should still be available as a fallback in case the forced config file is not valid.
        //if (userForcedAssignment !== undefined && userForcedAssignment.forcedAssetPack !== "" && userForcedAssignment.forcedAssetPack !== assetPackSettings[i].groupName) // if the user forced the current config file for the current NPC without specifying any subgroups, add the whole config file to the filtered list
        //{
        //    continue;
        //}

        if (assetPackSettings[i].gender !== NPCinfo.gender) // skip if the current config file is for the wrong gender
        {
            continue;
        }
        
        else
        {
            tmp = {}; // tmp is an object resembling a config file json object
            tmp.groupName = assetPackSettings[i].groupName;
            tmp.gender = assetPackSettings[i].gender;
            tmp.subgroups = assetPackSettings[i].subgroups; // needed to compatibilize requiredSubgroups (serves as subgroupHierarchy)
            tmp.flattenedSubgroups = [];

            for (let j = 0; j < assetPackSettings[i].flattenedSubgroups.length; j++)
            {
                tmp.flattenedSubgroups.push([]);
                for (let k = 0; k < assetPackSettings[i].flattenedSubgroups[j].length; k++)
                {
                    // if the current subgroup is either forced by user or valid for current NPC, keep it
                    if ((assetPackSettings[i].groupName === forcedAssetPack && forcedSubgroups[j] !== undefined && bForcedArrayContainsSubgroup(forcedSubgroups[j], assetPackSettings[i].flattenedSubgroups[j][k]) === true) || bSubgroupValidForCurrentNPC(NPCrecordHandle, assetPackSettings[i].flattenedSubgroups[j][k], NPCinfo, failureModes, xelib, logMessage, attributeCache) === true)
                    {
                        tmp.flattenedSubgroups[j].push(assetPackSettings[i].flattenedSubgroups[j][k]);
                    }
                }

                // if any subgroup slot is empty, skip this asset pack
                if (tmp.flattenedSubgroups[j].length === 0)
                {
                    if (userForcedAssignment !== undefined && userForcedAssignment.forcedAssetPack === tmp.groupName)
                    {
                        logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). The forced asset pack " + tmp.groupName + " could not be assigned because no subgroups within " + tmp.subgroups[j].id + " are valid for this NPC.");
                    }

                    emptyFlag = true;
                    break;
                }
            }
        }

        if (emptyFlag === false)
        {
            filtered.push(tmp);
        }
    }

    return filtered;
}

function bForcedArrayContainsSubgroup(forcedSubgroupList, subgroup)
{
    for (let i = 0; i < forcedSubgroupList.length; i++)
    {
        if (subgroup.containedSubgroupIDs.includes(forcedSubgroupList[i]) === true)
        {
            return true;
        }
    }
    return false;
}

function generateSubgroupChoiceList(assetPackSettings, gender)
{
    let allSubgroups = [];
    let weightedSubgroups = [];

    for (let i = 0; i < assetPackSettings.length; i++)
    {
        if (assetPackSettings[i].gender === gender)
        {
            generateChoiceListFromSubgroupList(assetPackSettings[i].flattenedSubgroups, allSubgroups, weightedSubgroups);
        }
    }

    if (weightedSubgroups.length > 0)
    {
        return weightedSubgroups; // discard the top-level subgroups that are not weighted by probability because they interfere with seed selection by probability weighting
    }
    else
    {
        return allSubgroups;
    }
}

function generateChoiceListFromSubgroupList(flattenedSubgroups, allSubgroups, weightedSubgroups)
{
    let subgroupList = [];
    let weightReporter = {}; // have to make an object to return by reference because javascript doesn't support multiple return values from a function
    for (let i = 0; i < flattenedSubgroups.length; i++)
    {
        subgroupList = Aux.generateSubgroupArrayByMultiplicity(flattenedSubgroups[i], weightReporter);

        allSubgroups.push(...subgroupList);
        if (weightReporter.weighted === true)
        {
            weightedSubgroups.push(...subgroupList);
            weightReporter.weighted = false;
        }
    }
}

function filterRequiredSubgroups(flattenedSubgroups, requirements, startIndex)
{
    let validSubgroups = [];
    for (let i = startIndex; i < flattenedSubgroups.length; i++)
    {
        validSubgroups = [];
        if (requirements[i] !== undefined)
        {
            for (let j = 0; j < requirements[i].length; j++)
            {
                for (let k = 0; k < flattenedSubgroups[i].length; k++)
                {
                    //if (flattenedSubgroups[i][k].id === requirements[i][j].id)
                    if (flattenedSubgroups[i][k].containedSubgroupIDs.includes(requirements[i][j]))
                    {
                        validSubgroups.push(flattenedSubgroups[i][k]);
                    }
                }
            }
        }

        if (validSubgroups.length > 0)
        {
            flattenedSubgroups[i] = validSubgroups;
        }
        else if (requirements[i] !== undefined && validSubgroups.length === 0)
        {
            return false;
        }
    }
}

function filterExcludedSubgroups(flattenedSubgroups, exclusions, startIndex)
{
    for (let i = startIndex; i < flattenedSubgroups.length; i++)
    {
        for (let j = 0; j < exclusions.length; j++)
        {
            for (let k = 0; k < flattenedSubgroups[i].length; k++)
            {
                if (flattenedSubgroups[i][k].containedSubgroupIDs.includes(exclusions[j]))
                {
                    flattenedSubgroups[i].splice(k, 1);
                    k--;
                }
            }
        }

        if (flattenedSubgroups[i].length === 0)
        {
            return false;
        }
    }
}

function addRequiredSubgroupsToPermutation(currentSubgroup, permutation)
{
    let currentSubgroup_Has_RequiredSubgroups = false;
    let req_Added = false;
    let compatibleFlag = false;
    let new_reqs = {};

    for (let index of Object.keys(currentSubgroup.requiredSubgroups))
    {
        new_reqs[index] = [];

        if (currentSubgroup.requiredSubgroups[index].length > 0)
        {
            currentSubgroup_Has_RequiredSubgroups = true;
        }

        if (permutation.requiredSubgroups[index] === undefined) // if no required subgroups exist at this index, simply add the ones from this subgroup
        {
            new_reqs[index] = [];
            for (let j = 0; j < currentSubgroup.requiredSubgroups[index].length; j++)
            {
                new_reqs[index].push(currentSubgroup.requiredSubgroups[index][j]);
                req_Added = true;
            }   
        }

        else if (permutation.requiredSubgroups[index].length > 0) // if required subgroups already exist at this index, only keep the ones that are mutually compatible
        {
            for (let i = 0; i < permutation.requiredSubgroups[index].length; i++)
            {
                for (let j = 0; j < currentSubgroup.requiredSubgroups[index].length; j++)
                {
                    if (permutation.requiredSubgroups[index][i].id === currentSubgroup.requiredSubgroups[index][j])
                    {
                        new_reqs[index].push(currentSubgroup.requiredSubgroups[index][j]);
                        req_Added = true;
                    }
                }
            }
        }

        else
        {
            let debug = "This should never be reached."
        }
        
    }

    if (currentSubgroup_Has_RequiredSubgroups === false)
    {
        compatibleFlag = true;
    }
    if (currentSubgroup_Has_RequiredSubgroups === true && req_Added === true)
    {
        for (let index of Object.keys(currentSubgroup.requiredSubgroups))
        {
            permutation.requiredSubgroups[index] = new_reqs[index];
        }
        compatibleFlag = true;
    }

    return compatibleFlag;
}

function addExcludedSubgroupsToPermutation(currentSubgroup, permutation)
{
    for (let i = 0; i < currentSubgroup.excludedSubgroups.length; i++)
    {
        permutation.excludedSubgroups.push(currentSubgroup.excludedSubgroups[i]);
    }
}

function filterSubgroupsByForceList(assetPacks, userForcedAssignment)
{
    bFiltered = false;
    let currentAssetPack;
    let forcedSubgroups = {};
    let forcedIndex = -1;
    let bSubgroupMatches = false;

    if (userForcedAssignment === undefined || userForcedAssignment.forcedAssetPack === "")
    {
        return false;
    }

    for (let i = 0; i < assetPacks.length; i++)
    {
        if (userForcedAssignment.forcedAssetPack !== assetPacks[i].groupName)
        {
            assetPacks.splice(i, 1);
            i--;
            continue;
        }

        currentAssetPack = assetPacks[i];

        // if the user only specifies the asset pack, remove all other asset packs from this list and keep the entirety of this one. Otherwise, filter the subgroups to match what the user requested
        if (userForcedAssignment.forcedSubgroups.length > 0)
        {
            // find top-level indices of the forced subgroups
            for (let j = 0; j < userForcedAssignment.forcedSubgroups.length; j++)
            { 
                for (let k = 0; k < currentAssetPack.subgroups.length; k++)
                {
                    if (userForcedAssignment.forcedSubgroups[j].topLevelSubgroup === currentAssetPack.subgroups[k].id)
                    {
                        forcedIndex = k;
                        if (forcedSubgroups[forcedIndex] === undefined)
                        {
                            forcedSubgroups[forcedIndex] = [];
                        }
                        forcedSubgroups[forcedIndex].push(userForcedAssignment.forcedSubgroups[j].id);
                    }
                }
            }

            // remove all subgroups at forced top-level indices that don't comply with user assignment
            for (let [index, IDs] of Object.entries(forcedSubgroups))
            {
                for (let j = 0; j < currentAssetPack.flattenedSubgroups[index].length; j++)
                {
                    if (bForcedArrayContainsSubgroup(IDs, currentAssetPack.flattenedSubgroups[index][j]) === false)
                    {
                        currentAssetPack.flattenedSubgroups[index].splice(j, 1);
                        j--;
                    }
                }
            }
        }
    }

    return true;
}

function filterSubgroupsByForceIf(assetPacks, NPCrecordHandle, logMessage, xelib, attributeCache)
{
    let bNPCHasMatchedForceIfs = false;
    let currentIndexMatchedForceIfs = [];
    let currentSubgroup;

    for (let i = 0; i < assetPacks.length; i++)
    {
        let currentAssetPack = assetPacks[i];
        for (let j = 0; j < currentAssetPack.flattenedSubgroups.length; j++)
        {
            currentIndexMatchedForceIfs = [];
            for (let k = 0; k < currentAssetPack.flattenedSubgroups[j].length; k++)
            {
                currentSubgroup = currentAssetPack.flattenedSubgroups[j][k];
                for (let z = 0; z < currentSubgroup.forceIfAttributes.length; z++)
                {
                    if (Aux.bAttributeMatched(currentSubgroup.forceIfAttributes[z][0], currentSubgroup.forceIfAttributes[z][1], NPCrecordHandle, logMessage, xelib, attributeCache))
                    {
                        currentIndexMatchedForceIfs.push(currentSubgroup);
                    }
                }
            }

            if (currentIndexMatchedForceIfs.length > 0)
            {
                bNPCHasMatchedForceIfs = true;
                currentAssetPack.flattenedSubgroups[j]  = currentIndexMatchedForceIfs;
            }
        }
    }

    return bNPCHasMatchedForceIfs;
}

// NOTE FOR LATER - Need to compare genereated permutation to previously generated ones to make sure it's not generating the same one repeatedly and getting rejected later during BodyGen integration
function generatePermutation(assetPackSettings, NPCrecordHandle, userForcedAssignment, NPCinfo, failureModes, bEnableBodyGenIntegration, xelib, logMessage, attributeCache) // assetPackSettings here is a deep copy and can be pruned.
{
    let permutation = {};

    let subgroupChoiceListPrimary = [];
    let subgroupChoiceListSecondary = [];
    let initSubgroup = {};
    let currentSubgroup = {};
    let chosenAssetPack;
    let bValidChoice = false;
    let bSubgroupCompatibleWithPermutation = false;
    let bSubgroupCompatibleWithNPC = false;
    let bPermutationCreated = false;

    let trialFlattenedSubgroups = [];
    let trialPermutation = {};
    let trialSubgroup = {};

    let flattenedSubgroupArchive = [];
    let permutationArchive = [];

    let pre_filtered = angular.copy(assetPackSettings);

    let bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment);
    let bFilteredByForceIf = filterSubgroupsByForceIf(assetPackSettings, NPCrecordHandle, logMessage, xelib, attributeCache);
    let fallbackStatement = "";

    while (bPermutationCreated === false)
    {
        // pick a nucleating subgroup
        subgroupChoiceListPrimary = generateSubgroupChoiceList(assetPackSettings, NPCinfo.gender);        
        
        if (subgroupChoiceListPrimary.length === 0) // if no valid seed subgroups remain
        {
            // if the list of subgroups has been filtered by BOTH user force list AND forceIf, try filtering only by user force list
            if (bFilteredByUserForceList === true && bFilteredByForceIf === true)
            {
                assetPackSettings = angular.copy(pre_filtered);
                bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment);
                bFilteredByForceIf = false;
                subgroupChoiceListPrimary = generateSubgroupChoiceList(assetPackSettings, NPCinfo.gender);
                fallbackStatement += "No valid permutations were generated when filtering by user-forced assignments AND forceIf assignments. Falling back to filtering only by user-forced assignments. ";
            }

            // if the list of subgroups has been filtered ONLY by forceIf:
            else if (bFilteredByForceIf === true)
            {
                // if a user force list exists, try filtering only on that
                if (bFilteredByUserForceList === true)
                {
                    assetPackSettings = angular.copy(pre_filtered);
                    bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment);
                    fallbackStatement += "No valid permutations were generated when filtering by forceIf assignments. Falling back to filtering only by user-forced assignments. ";  
                }
                // if a user force list does not exist, try generating a permutation without filtering
                else
                {
                    assetPackSettings = angular.copy(pre_filtered);
                    fallbackStatement += "No valid permutations were generated when filtering by forceIf assignments. Falling back to unfiltered subgroups. ";
                }
                subgroupChoiceListPrimary = generateSubgroupChoiceList(assetPackSettings, NPCinfo.gender);
                bFilteredByForceIf = false;
            }
            // if the list of subgroups has been filtered ONLY by user forced list, try generating a permutation with only filtering by forceIf
            else if (bFilteredByUserForceList === true)
            {
                assetPackSettings = angular.copy(pre_filtered);
                bFilteredByForceIf = filterSubgroupsByForceIf(assetPackSettings, NPCrecordHandle, logMessage, xelib, attributeCache);
                if (bFilteredByForceIf === true)
                {
                    fallbackStatement += "No valid permutations were generated when filtering by user-forced assignments. Falling back to filtering only by ForceIf subgroups. ";
                }
                else
                {
                    fallbackStatement += "No valid permutations were generated when filtering by user-forced assignments. Falling back to unfiltered subgroups. ";
                }
                subgroupChoiceListPrimary = generateSubgroupChoiceList(assetPackSettings, NPCinfo.gender);
                bFilteredByUserForceList = false;
            }
            // if no permutations could be generated even without filtering, break out of the loop
            else
            {
                break; // break out of main loop if none of the available subgroups can seed a valid permutation
            }
        }
        initSubgroup = subgroupChoiceListPrimary[Math.floor(Math.random() * subgroupChoiceListPrimary.length)];
        for (let i = 0; i < assetPackSettings.length; i++)
        {
            if (assetPackSettings[i].groupName === initSubgroup.parentAssetPack)
            {
                chosenAssetPack = assetPackSettings[i];
                break;
            }
        }

        // generate archive of available subgroups at each stage of permuation building to facilitate backtracking
        flattenedSubgroupArchive = [];
        permutationArchive = [];
        for (let i = 0; i < chosenAssetPack.flattenedSubgroups.length; i++)
        {
            flattenedSubgroupArchive.push([]);
            permutationArchive.push({});
        }
        //

        permutation = new permutationHolder(chosenAssetPack.groupName);
        permutation.gender = chosenAssetPack.gender;
        addRequiredSubgroupsToPermutation(initSubgroup, permutation);
        addExcludedSubgroupsToPermutation(initSubgroup, permutation);

        // filter the rest of the subgroups to comply with the initial requirements and exclusions
        if (filterRequiredSubgroups(chosenAssetPack.flattenedSubgroups, permutation.requiredSubgroups, 0) === false)
        {
            Aux.stripSubgroupInstancesFromList(initSubgroup, chosenAssetPack.flattenedSubgroups[initSubgroup.topLevelIndex]);
            continue; // choose new seed subgroup
        }

        // fill out the rest of the permutation

        let flattenedSubgroupsSecondary = Aux.copyFlattenedSubgroupArray(chosenAssetPack.flattenedSubgroups);
        flattenedSubgroupsSecondary[initSubgroup.topLevelIndex] = [initSubgroup]; // since the only subgroup that works here is the seed subgroup, make sure that the only subgroup in the array is the seed subgroup

        for (let i = 0; i < flattenedSubgroupsSecondary.length; i++)
        {
            flattenedSubgroupArchive[i] = Aux.copyFlattenedSubgroupArray(flattenedSubgroupsSecondary);
            permutationArchive[i] = angular.copy(permutation);

            bValidChoice = false;

            while (bValidChoice === false && flattenedSubgroupsSecondary[i].length > 0)
            {
                bSubgroupCompatibleWithPermutation = false;
                bSubgroupCompatibleWithNPC = false;

                subgroupChoiceListSecondary = Aux.generateSubgroupArrayByMultiplicity(flattenedSubgroupsSecondary[i], {});
                currentSubgroup = subgroupChoiceListSecondary[Math.floor(Math.random() * subgroupChoiceListSecondary.length)];

                trialPermutation = angular.copy(permutation);
                trialSubgroup = angular.copy(currentSubgroup);
                trialFlattenedSubgroups = Aux.copyFlattenedSubgroupArray(flattenedSubgroupsSecondary);

                if (PG.bResolveSubgroupPermutationConflicts(trialSubgroup, trialPermutation, chosenAssetPack.subgroups, bEnableBodyGenIntegration) === true)
                {                    
                    if (filterRequiredSubgroups(trialFlattenedSubgroups, trialPermutation.requiredSubgroups, i) !== false) // returns false if none of the remaining subgroups are compatible with the filter
                    {
                        if (filterExcludedSubgroups(trialFlattenedSubgroups, trialPermutation.excludedSubgroups, i) !== false)
                        {
                            bValidChoice = true;
                        }
                        else
                        {
                            let debug3;
                        }
                    }
                    else
                    {
                        let debug2;
                    }
                }
                else
                {
                    let debug1;
                }

                if (bValidChoice === true)
                {
                    permutation = trialPermutation;
                    currentSubgroup = trialSubgroup;
                    PG.appendSubgroupToPH(currentSubgroup, permutation);

                    flattenedSubgroupsSecondary = trialFlattenedSubgroups;
                }
                else
                {
                    Aux.stripSubgroupInstancesFromList(currentSubgroup, flattenedSubgroupsSecondary[currentSubgroup.topLevelIndex]);
                }
            } 

            if (flattenedSubgroupsSecondary[i].length === 0 && bValidChoice === false)
            {
                // if none of the current subgroups at the current index are valid:

                // if this is the first subgroup, pick a different seed
                if (i === 0)
                {
                    Aux.stripSubgroupInstancesFromList(initSubgroup, chosenAssetPack.flattenedSubgroups[initSubgroup.topLevelIndex]); // since chosenAssetPack links back to assetPackSettings by reference, this edit will carry through to assetPackSettings, stripping the subgroup from the primary selection list.
                    break; // out of for loop. Since bPermutationCreated = false in this case, this will go to the start of the main while loop to draw a new initSubgroup
                }
                else
                {
                    // go back to the previous index, restoring the subgroups available to choose from at that index
                    i--; // now at previous index
                    Aux.stripSubgroupInstancesFromList(permutation.subgroups[i], flattenedSubgroupArchive[i][i]); 
                    flattenedSubgroupsSecondary = flattenedSubgroupArchive[i];
                    permutation = permutationArchive[i];
                    i--; // go back one more so that the next iteration of the for loop brings i back to the correct index
                }
            }
            else if (permutation.subgroups.length === chosenAssetPack.flattenedSubgroups.length)
            {
                bPermutationCreated = true;
            }
        }
    }

    if (bPermutationCreated === true)
    {
        if (fallbackStatement !== "")
        {
            logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "): " + fallbackStatement);
        }

        return permutation;
    }
    else
    {
        return undefined;
    }
}

// this function writes recordTemplates (loaded from JSON and modified as instructed by permutations) to the ESP file.
// it is different from the one in ObjectToRecord.js because it allows for other record objects to be referenced dynamically
function chooseRandomPermutation(assetPackSettings, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, userForcedSubgroupsApplied, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, failureModes, raceAliases, xelib, logMessage, attributeCache)
{
    // vars for permutation generation

    let bValidChoice = false;
    let validPermutations_withoutConsistency = []; // cache of valid permutations (for storing permutations that themselves conform to NPC's requirements, but do not pair with any BodyGen morphs). Must be compatible with the BodyGen morph stored in consistency
    let validPermutations_withoutBodyGen = [];
    let chosenMorph;
    let chosenMorph2;
    let permutationToReturn;
    let bConsistencyMorphExists = NPCinfo.consistencyIndex >= 0 && consistencyRecords[NPCinfo.consistencyIndex] !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined;
    let bPermutationMorphConflict = false;
    let passConsistencyMessage = {};
    
    while (bValidChoice === false)
    {
       permutationToReturn = generatePermutation(assetPackSettings, NPCrecordHandle, userForcedAssignment, NPCinfo, failureModes, bEnableBodyGenIntegration, xelib, logMessage, attributeCache);

       if (permutationToReturn === undefined)
       {
           break; // if no permutation is able to be generated for this NPC at any point, regardless of BodyGen compatibility, break and report error to user.
       }
       else
       {
           bValidChoice = true; // unless the BodyGen check below sets it back to false, in which case another permutation will be generated
       }

        // Get BodyGen for current permutation
        
        if (bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false)
        {
            validPermutations_withoutBodyGen.push(permutationToReturn);
            // is the chosen permutation compatible with the consistency morph?
            chosenMorph = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, permutationToReturn, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, passConsistencyMessage);
            
            // if the chosen morph is undefined, look to see if a morph would be available to the NPC without the constraints imposed by this permutation
            if (chosenMorph === undefined)
            {
                chosenMorph2 = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, undefined, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, {});
                // If not, no need to explore other permutations for compatibilty. keep this permutation, don't assign the morph, and let index.js call assignMorphs(again) with the error logging unsuppressed to alert the user. Since the reasons for listed for failed morphs will be unrelated to the chosen permutation, no need to flag the user here
                if (chosenMorph2 === undefined)
                {
                    return permutationToReturn;
                }
                else
                {
                    bPermutationMorphConflict = true;
                }
            }

            // if BGI.assignMorphs was able to pick a valid morph for this permutation:

            // if there is no consistency morph for this NPC
            // OR if there is a consistency morph for this NPC and the chosen morph is the consistency morph
            // OR if the consistency morph was invalid (indicated by passConsistencyMessage.message being not undefined)
            // keep both the current valid permutation and the current valid morph
            else if (bConsistencyMorphExists === false || (bConsistencyMorphExists === true && chosenMorph.morphs === consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs) || passConsistencyMessage.message !== undefined)
            {
                assignedBodyGen[NPCinfo.formID] = chosenMorph;
                return permutationToReturn;
            }

            // if there is a valid consistency morph for this NPC and the chosen morph is NOT the consistency morph, store both as fallback options
            else if (bConsistencyMorphExists === true && passConsistencyMessage.message === undefined && chosenMorph.morphs !== consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs)
            {
                validPermutations_withoutConsistency.push([permutationToReturn, chosenMorph]);
            }

            // if conditions to return have not yet been met, BodyGen criteria have not been satisfied so loop through other permutations
            bValidChoice = false;
        }
        else
        {
            return permutationToReturn;
        }
    }

    // if no permutation was drawn with the consistency body morph, but there was a permutation drawn compatible with a non-consistency morph, warn the user that the consistency morph will be overwriten
    if (validPermutations_withoutConsistency.length >  0)
    {
        logMessage("\nAsset Assignment: Could not assign a permutation to NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") that is compatible with its consistency BodyGen morph. A valid permutation was assigned, but BodyGen assignment will be re-randomized.");
        assignedBodyGen[NPCinfo.formID] = validPermutations_withoutConsistency[0][1];
        return validPermutations_withoutConsistency[0][0];
    }

    // if the function gets this far, it means that bodygen is enabled and none of the permutations picked had a compatible bodygen.
    if (bPermutationMorphConflict === true) // if there are morphs that would be available to the NPC without the permutation's constraints, notify the user of the conflict
    {
        logMessage("\nAsset Assignment: NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with any permutation + BodyGen morph combination due to mutually conflicting constraints. A valid permutation was assigned, but BodyGen assignment will proceed without respecting this permutation's constraints.")
        return validPermutations_withoutBodyGen[0];
    }

    return undefined; // any successful case will have returned from above
}

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

function bSubgroupValidForCurrentNPC(NPCrecordHandle, subgroup, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let bAttributeMatched = false;
    let bSubgroupForced = false;
    let tmpFailureStr = "";
    let bMissingAllAllowedAttriubutes = false;

    // new in 1.9: race check is done here instead of at permutation level
    if (subgroup.allowedRaces.length > 0 && subgroup.allowedRaces.includes(NPCinfo.race) === false)
    {
        Aux.updateFailureModes(failureModes, "Subgroup is not eligible for NPCs of race " + NPCinfo.race);
        return false;
    }
    // "Distribution enabled"
    if (subgroup.distributionEnabled === false)
    {
        Aux.updateFailureModes(failureModes, "Distribution disabled for non-user-forced NPCs");
        return false;
    }

    // "Allow unique NPCs"
    if (subgroup.allowUnique === false && NPCinfo.isUnique === true)
    {
        Aux.updateFailureModes(failureModes, "Distribution disallowed for unique NPCs");
        return false;
    }

    // "Allow non-unique NPCs"
    if (subgroup.allowNonUnique === false && NPCinfo.isUnique === false)
    {
        Aux.updateFailureModes(failureModes, "Distribution disallowed for non-unique NPCs");
        return false;
    }

    // "weight range"
    if (Aux.isValidNumber(subgroup.weightRange[0]) && NPCinfo.weight < subgroup.weightRange[0])
    {
        Aux.updateFailureModes(failureModes, "NPC weight (" + NPCinfo.weight.toString() + ") <  " + subgroup.weightRange[0].toString());
        return false;
    }
    if (Aux.isValidNumber(subgroup.weightRange[1]) && NPCinfo.weight > subgroup.weightRange[1])
    {
        Aux.updateFailureModes(failureModes, "NPC weight (" + NPCinfo.weight.toString() + ") >  " + subgroup.weightRange[1].toString());
        return false;
    }

//FIX LATER       bSubgroupForced = permutation.forceIfSubgroupsApplied.includes(subgroup.id); // true if subgroup is forced via ForceIF attributes

    // "Disallowed Attributes"
    for (let j = 0; j < subgroup.disallowedAttributes.length; j++) 
    {
        if (Aux.bAttributeMatched(subgroup.disallowedAttributes[j][0], subgroup.disallowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache)) // if current NPC matches current subgroup's disallowed attribute
        {
            // ignore if attribute is forced by user OR attribute is also a forceIf attribute
            if (bSubgroupForced === false)
            {
                Aux.updateFailureModes(failureModes, "NPC has disallowed attribute: (" + subgroup.disallowedAttributes[j][0] + ": " + subgroup.disallowedAttributes[j][1] + ") (imposed by subgroup " + subgroup.id + ")");
                return false;
            }

        }
    }
    
    // "Allowed Attributes"
    tmpFailureStr = "NPC lacks any of the following allowed attributes:\n";
    for (let j = 0; j < subgroup.allowedAttributes.length; j++) 
    {
        bAttributeMatched = Aux.bAttributeMatched(subgroup.allowedAttributes[j][0], subgroup.allowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache);
        if (bAttributeMatched === true)
        {
            break;
        }
        else
        {
            tmpFailureStr += " (" + subgroup.allowedAttributes[j][0] + ": " + subgroup.allowedAttributes[j][1] + ")\n"
        }
    }

    bMissingAllAllowedAttriubutes = (subgroup.allowedAttributes.length > 0 && bAttributeMatched === false);
    if (bMissingAllAllowedAttriubutes === true && bSubgroupForced === false) // if the NPC lacks at least one of this subgroup's allowed attributes AND the subgroup is not forced by either the user or a forceIF, disallow it
    {
        tmpFailureStr += " imposed by subgroup " + subgroup.id;
        Aux.updateFailureModes(failureModes, tmpFailureStr);
        return false;
    }

    return true;
}

// this function finds the given NPC within the consistency record
function findNPCAssignmentIndex(consistencyRecords, NPCinfo)
{
    let index = -1;
    let NPCsignature = NPCinfo.formID.substring(2, 9);

    for (let i = 0; i < consistencyRecords.length; i++)
    {
        if (consistencyRecords[i].rootPlugin === NPCinfo.rootPlugin && consistencyRecords[i].formIDSignature === NPCsignature)
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
    let FormIDSigRef = NPCinfo.formID.substring(2, 9);
    let FormIDSigCurrent = "";

    if (NPCList === undefined || NPCList.length === 0) { return  -1; }
    
    // priority: formID, EDID, name, rootPlugin
    for (let i = 0; i < NPCList.length; i++)
    {
        FormIDSigCurrent = NPCList[i].formID.substring(2, 9);

        if (NPCList[i].rootPlugin === NPCinfo.rootPlugin && FormIDSigRef === FormIDSigCurrent)
        {
            return i;
        }       
    }
    
    return index;
}

function drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, userForcedSubgroupsApplied, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, raceAliases, xelib, logMessage, attributeCache)
{
    let failureModes = {};
    let passConsistencyMessage = {};
    let logString = "";
    if (bEnableConsistency === true && bNPCfoundInConsistencyRecords === true)
    {
        let permutationToReturn = findPermutationFromConsistency(permutations, consistencyRecords[NPCinfo.consistencyIndex], userForcedAssignment);

        if (permutationToReturn === undefined)
        {
            logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not generated using the currently supplied asset configuration files (or was removed when filtering by Specific NPC Assignments or ForceIf Attributes for this NPC). Assigning a new permutation.");
            return undefined;
        }

        if (permutationToReturn === "ForcedAssignmentIncompatible")
        {
            logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be assigned consistently with the subgroups defined in ForceNPCList.json. Assigning a new permutation.");
            return undefined;
        }

        else if (bPermutationValidForCurrentNPC(NPCrecordHandle, permutationToReturn, userForcedSubgroupsApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache) === true)
        {
            // if bodygen is enabled, make check to see if a valid morph can be drawn
            if (bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false)
            {
                let chosenMorph = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, permutationToReturn, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, passConsistencyMessage);
                
                // if the morph is valid and matches the consistency morph, or there is no consistency morph, return the permutation and morph

                if (chosenMorph !== undefined && (consistencyRecords[NPCinfo.consistencyIndex] === undefined || consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs === chosenMorph.morphs))
                {
                    assignedBodyGen[NPCinfo.formID] = chosenMorph;
                }

                // if the drawn morph is not the same one as in the consistency records, warn the user
                else if (consistencyRecords[NPCinfo.consistencyIndex] !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined && (chosenMorph === undefined || consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== chosenMorph.morphs))
                {
                    if (passConsistencyMessage.message !== undefined)
                    {
                        logString += "\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be paired with the consistency morph because " + passConsistencyMessage.message;
                        //logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be paired with the consistency morph because " + passConsistencyMessage.message + " Keeping the consistency permutation and assigning a random BodyGen morph.");
                    }
                    else
                    {
                        logString += "\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with the BodyGen morph specified in the consistency file.";
                        //logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with the BodyGen morph specified in the consistency file. Keeping the consistency permutation and assigning a random BodyGen morph.");
                    }

                    if (chosenMorph !== undefined) // if a morph can be drawn, keep the consistency assignment and the morph
                    {
                        logString += "\nKeeping the consistency permutation and assigning a new BodyGen morph.";
                        assignedBodyGen[NPCinfo.formID] = chosenMorph;
                    }
                
                    // if a morph could not be drawn, check if any available morphs would be valid without constraints from the consistency permutation
                    // if the consistency permutation cannot be combined with any morphs, but there would be valid morphs without the constraints from the consistency permutation, discard the consistency permutation and warn the user
                    // if no morphs are valid even without the constraints from the consistency permutation, keep the consistency permutation
                    else if (BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, undefined, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, passConsistencyMessage) !== undefined) // true if there are morphs available without constraints from consistency permutation
                    {
                        logString += "\nAdditionally, the permutation specified in the consistency file was not compatible with any other BodyGen morphs available to this NPC. Assigning a new permutation.";
                        permutationToReturn = undefined;
                    }
                } 
            }

            if (logString !== "")
            {
                logMessage(logString);
            }

            return permutationToReturn;
        } 
        
        // if a suitable permutation was not found, warn user
        else
        {
            logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be assigned. Assigning a random permutation.");
            logMessage(Aux.formatFailureModeString_consistency(failureModes, "permutation"));
        }
    }

    return undefined; // only reached if the permutation from consistency was not found or not compatible with current settings.
}

function findPermutationFromConsistency(permutations, NPCAssignment, userForcedAssignment)
{
    let toReturn = undefined;
    let assignmentComparatorPack = "";
    let assignmentComparatorID = "";
    let NPCcomparatorPack = "";
    let NPCcomparatorID = "";
    let bForcedAssignmentIncompatible = false;
    let bForcedSubgroupFound = false;

    assignmentComparatorPack = NPCAssignment.assignedAssetPack.trim();
    assignmentComparatorID = NPCAssignment.assignedPermutation.trim();
    for (let i = 0; i < permutations.length; i++)
    {
        NPCcomparatorPack = permutations[i].sourceAssetPack.trim();
        NPCcomparatorID = permutations[i].nameString.trim();
        if (assignmentComparatorPack === NPCcomparatorPack && assignmentComparatorID === NPCcomparatorID)
        {
            toReturn = permutations[i];
            // check to make sure the consistency permutation is allowed by the forced assignment
            if (userForcedAssignment !== undefined && userForcedAssignment.forcedAssetPack !== "")
            {
                if (userForcedAssignment.forcedAssetPack !== assignmentComparatorPack)
                {
                    bForcedAssignmentIncompatible = true;
                }
                else
                {
                    // check all forced subgroups are represented
                    for (let j = 0; j < userForcedAssignment.forcedSubgroups.length; j++)
                    {
                        bForcedSubgroupFound = false;
                        for (let k = 0; k < toReturn.subgroups.length; k++)
                        {
                            if (toReturn.subgroups[k].id === userForcedAssignment.forcedSubgroups[j].id)
                            {
                                bForcedSubgroupFound = true;
                                break;
                            }
                        }

                        // if a subgroup was not found, stop looking
                        if (bForcedSubgroupFound === false)
                        {
                            bForcedAssignmentIncompatible = true;
                            break;
                        }
                    }
                    if (bForcedAssignmentIncompatible === true)
                    {
                        break;
                    }
                }
            }
            break;
        }     
    }

    if (bForcedAssignmentIncompatible === true)
    {
        toReturn = "ForcedAssignmentIncompatible";
    }

    return toReturn;
}

function updatePermutationConsistencyRecord(assignmentRecord, chosenPermutation)
{
    if (chosenPermutation === undefined)
    {
        if (assignmentRecord !== undefined)
            {
            if (assignmentRecord.assignedAssetPack !== undefined)
            {
                delete assignmentRecord.assignedAssetPack;
            }
            if (assignmentRecord.assignedPermutation !== undefined)
            {
                delete assignmentRecord.assignedPermutation;
            }
        }
    }
    else
    {
        assignmentRecord.assignedAssetPack = chosenPermutation.sourceAssetPack;
        assignmentRecord.assignedPermutation = chosenPermutation.nameString; 
    }
}

function updateHeightConsistencyRecord(assignmentRecord, height)
{
    assignmentRecord.height = height;
}

function generatePermutationChoiceArray(permutationArray)
{
    let toReturn = [];

    for (let i = 0; i < permutationArray.length; i++)
    {
        for (let j = 0; j < permutationArray[i].probabilityWeighting; j++)
        {
            toReturn.push(i);
        }
    }

    return toReturn;
}

function filterPermutationsByUserForceList(permutations, permutationsByRaceGender, userForcedAssignment, bAssetsForcedByUser, logMessage, NPCinfo, bAllowOtherRGCombos) // bAllowOtherRGCombos significantly increases processing time
{
    let userForcedSubgroupsApplied = [];
    let userForcedPermutations = [];
    let otherRGPermutations = [];

    if (bAssetsForcedByUser === true)
    {
        if (userForcedAssignment.forcedAssetPack === "") { return false; } // no forced asset packs or subgroups if the default "" value.
        for (let i = 0; i < permutations.length; i++)
        {
            // first check for the asset pack
            if (permutations[i].sourceAssetPack !== userForcedAssignment.forcedAssetPack)
            {
                continue;
            }
            else if (userForcedAssignment.forcedSubgroups.length === 0) // if the user didn't specify subgroups and only specified the asset pack, add all subgroups from that asset pack
            {
                userForcedPermutations.push(permutations[i]);
            }

            else if (permutationAllowedByUserForceList(userForcedAssignment, permutations[i]) === true) // otherwise check if the user allowed that subgroup
            {
                userForcedPermutations.push(permutations[i]);
            }
        }

        // search permutations from other races and genders
        if (bAllowOtherRGCombos === true && userForcedPermutations.length === 0)
        {
            for (let i = 0; i < permutationsByRaceGender.length; i++)
            {
                otherRGPermutations = permutationsByRaceGender[i];
                for (let j = 0; j < otherRGPermutations.permutations.length; j++)
                {
                    // first check for the asset pack
                    if (otherRGPermutations.permutations[j].sourceAssetPack !== userForcedAssignment.forcedAssetPack)
                    {
                        continue;
                    }
                    else if (userForcedAssignment.forcedSubgroups.length === 0) // if the user didn't specify subgroups and only specified the asset pack, add all subgroups from that asset pack
                    {
                        userForcedPermutations.push(otherRGPermutations.permutations[j]);
                    }
                    else if (permutationAllowedByUserForceList(userForcedAssignment, otherRGPermutations.permutations[j]) === true)
                    {
                        userForcedPermutations.push(otherRGPermutations.permutations[j]);
                    }
                }
            }
        }

        // warn user if no compliant permutations found
        if (userForcedPermutations.length === 0)
        {
            logMessage("\nAsset Assignment: no generated permutations comply with the subgroups forced in ForceNPCList.json for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). Assigning a random permutation.");
        }
        else
        {
            Aux.replaceArrayValues(permutations, userForcedPermutations); // replace the values within permutations by reference so that it returns to the calling function (reminder that simply setting it to = breaks the reference
            // collect the user-forced subgroup IDs into an array (used downstream by bPermutationValidForCurrentNPC(...))
            for (let i = 0; i < userForcedAssignment.forcedSubgroups.length; i++)
            {
                userForcedSubgroupsApplied.push(userForcedAssignment.forcedSubgroups[i].id);
            }
        }
    }
    return userForcedSubgroupsApplied;
}

// this function returns true if each of the user-forced subgroups are contained within the given permutation
function permutationAllowedByUserForceList(userForcedAssignment, permutation)
{
    if (userForcedAssignment === undefined)
    {
        return true;
    }

    if (userForcedAssignment.forcedAssetPack !== "")
    {
        if (permutation.sourceAssetPack !== userForcedAssignment.forcedAssetPack)
        {
            return false;
        }
        else if (userForcedAssignment.forcedSubgroups !== undefined && userForcedAssignment.forcedSubgroups.length > 0)
        {
            for (let i = 0; i < userForcedAssignment.forcedSubgroups.length; i++)
            {
                if (bPermutationContributingSubgroupIDsContain(permutation, userForcedAssignment.forcedSubgroups[i].id) === false)
                {
                    return false;
                }
            }
        }
    }

    return true;
}

function bPermutationContributingSubgroupIDsContain(permutation, toSearch)
{
    for (let i = 0; i < permutation.contributingSubgroupIDs.length; i++)
    {
        if (permutation.contributingSubgroupIDs[i].includes(toSearch) === true)
        {
            return true;
        }
    }
    return false;
}

function filterPermutationsbyForceIfAttributes(NPCrecordHandle, userForcedSubgroupsApplied, NPCinfo, permutations, logMessage, xelib, attributeCache)
{
    let forcedpermutations = []; // all permutations with forceIf attributes that match current NPC
    let filteredpermutations = []; // permutations with the maximum number of subgroups containing forceIf attributes that match the current NPCs
    let maxUniqueForceIfConditionsFound = 0; // track unique top-level subgroups specified by forceIfAttributes to determine the specificity of the permutations and filter for the most specific ones

    // get forced permutations
    for (let i = 0; i < permutations.length; i++)
    {
        permutations[i].forceIfSubgroupsApplied = [];
        for (let j = 0; j < permutations[i].subgroups.length; j++)
        {
            for (let k = 0; k < permutations[i].subgroups[j].forceIfAttributes.length; k++)
            {
                if (Aux.bAttributeMatched(permutations[i].subgroups[j].forceIfAttributes[k][0], permutations[i].subgroups[j].forceIfAttributes[k][1], NPCrecordHandle, logMessage, xelib, attributeCache))
                {
                    permutations[i].forceIfSubgroupsApplied.push(permutations[i].subgroups[j].id);
                    break;
                }
            }
        }

        if (permutations[i].forceIfSubgroupsApplied.length > 0 && bPermutationValidForCurrentNPC(NPCrecordHandle, permutations[i], userForcedSubgroupsApplied, NPCinfo, {}, xelib, logMessage, attributeCache) === true)
        {
            forcedpermutations.push(permutations[i]);

            // track how many subgroups are forced (only the permutations with the highest number of forced subgroups make it to the final filtered list)
            if (permutations[i].forceIfSubgroupsApplied.length > maxUniqueForceIfConditionsFound)
            {
                maxUniqueForceIfConditionsFound = permutations[i].forceIfSubgroupsApplied.length;
            }
        }
    }

    // get filtered permutations
    if (forcedpermutations.length > 0) // this is only true if the NPC's attributes matched a forceIfAttribute of at least one permutation
    {
        // prune the forceIf permutations to the ones that satisfy the highest number of forceIf conditions:
        // E.G: Permutation1 has requirement for condition A and condition B, and NPC meets both
        //      permutation 2 has requirement for condition A only, and the NPC meets it
        //      Only Permutation 1 should be returned, because it is more specific to the NPC than permutation2
        
        for (let i = 0; i < forcedpermutations.length; i++)
        {
            if (forcedpermutations[i].forceIfSubgroupsApplied.length === maxUniqueForceIfConditionsFound) // uniqueForceIfTopLevelSubgroupCounts has the same indices as forcedpermutations because they're pushed on the same condition
            {
                filteredpermutations.push(forcedpermutations[i]);
            }
        }

        Aux.replaceArrayValues(permutations, filteredpermutations); // replace the values within permutations by reference so that it returns to the calling function (reminder that simply setting it to = breaks the reference)
    }
}

function addAssignedNPCtoPermutation(originalpermutations, permutationToReturn, NPCinfo)
{
    for (let i = 0; i < originalpermutations.length; i++)
    {
        if (originalpermutations[i].nameString === permutationToReturn.nameString)
        {
            originalpermutations[i].NPCsAssignedTo.push("[" + NPCinfo.name + "|" + NPCinfo.EDID + "|" + NPCinfo.formID + "]");
            break;
        }
    }
}

class permutationHolder
{
    constructor(name)
    {
        this.sourceAssetPack = name;
        this.nameString = "";
        this.paths = [],
        this.allowedBodyGenDescriptors = {}; /// NOTE THIS IS OBJECT NOT ARRAY
        this.disallowedBodyGenDescriptors = [];
        this.addKeywords = [],

        // the following variables are used for the algorithm that determines if the given permutation is allowed for a given NPC
        this.probabilityWeighting= 1;
        this.gender = "";
        this.allowedRaces = [];
        this.disallowedRaces = [],
        this.subgroups = []; 

        // The following variables are used to build up the permutations, but do not impact the algorithm that determines if the given permutation is allowed for a given NPC
        this.requiredSubgroups = {}, /// NOTE THIS IS OBJECT NOT ARRAY
        this.excludedSubgroups = [],
        this.contributingBottomLevelSubgroupIDs = []; // these are only the terminal nodes
        this.contributingSubgroupIDs = []; // includes non-terminal nodes
        this.emptyFlagAR = true; // tells the conflict checker function that this permutation has no allowedRaces due to user input rather than conflict pruning
        
        // The following variables are used for logging, but do not impact the algorithm that determines if the given permutation is allowed for a given NPC
        this.distributionEnabled = true; // function assignSubgroupArraysToPermutationObjects assumes default = true and searches subgrups for false.
        this.allowUnique = true;
        this.allowNonUnique = true;
        this.allowedAttributes = [],
        this.disallowedAttributes = [],
        this.forceIfAttributes = [],
        this.weightRange = [],
        this.contributingSubgroupNames = []; // includes non-terminal nodes
        this.NPCsAssignedTo = []; // for the log; assigned during patch function
    }
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

function getFormIDFromLinkTo(record, categorizedRecords)
{
    return categorizedRecords[record.$zEBDLinkTo.zEBDUniqueID][record.$zEBDLinkTo.sourceAssetPack][record.$zEBDLinkTo.index].zEBDformID;
}

function linkPermutationToUniques(permutationToReturn, permutations)
{
    let bUnique = true;
    for (let i = 0; i < permutations.length; i++)
    {
        if (permutationToReturn.sourceAssetPack === permutations[i].sourceAssetPack && permutationToReturn.nameString === permutations[i].nameString)
        {
            permutationToReturn = permutations[i];
            bUnique = false;
        }
    }

    if (bUnique === true)
    {
        permutations.push(permutationToReturn);
    }
    
    return permutationToReturn;
}

// Auxilliary Code Block

function generateRandomNumber_Uniform(min, max) 
{
    return Math.random() * (max - min) + min;
};

// from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
function generateRandomNumber_Gaussian(min, max) // min and max interpreted to be 3 sigma, and capped
{
    let skew = 1; // centers the distribution - see above link

    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = randn_bm(min, max, skew); // resample between 0 and 1 if out of range
    num = Math.pow(num, skew); // Skew
    num *= max - min; // Stretch to fill range
    num += min; // offset to min
    return num;
}
