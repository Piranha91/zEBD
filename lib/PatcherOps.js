debugger;
let Aux = require('./Auxilliary.js');
let BGI = require('./BodyGenIntegration.js')(Aux);

module.exports = function(logDir, fh, xelib)
{
    let PO = {};

    PO.writeAssets = function(assetRecords, patchFile, logMessage, patchableRaces, RNAMdict)
    {
        let maxPriority = assetRecords.maxPriority;
        let recordsToWrite = assetRecords.recordTemplates;
        let currentRecordHandle;
        let recordCounter = 0;
        let basePath = "";
        let EDIDarray = [];

        for (let i = maxPriority; i >= 0; i--)
        {
            counter = 0;
            for (let j = 0; j < recordsToWrite.length; j++)
            {
                if (recordsToWrite[j].zEBDpriority === i)
                {
                    recordCounter++;
                    counter++;
                    basePath = recordsToWrite[j].zEBDSignature + "\\" + recordsToWrite[j].zEBDSignature;
                    currentRecordHandle = xelib.AddElement(patchFile, basePath);
                    writeTemplateToRecord(recordsToWrite[j], currentRecordHandle, xelib, "", EDIDarray, patchableRaces, RNAMdict);
                    if (recordCounter % 100 === 0) { logMessage("Wrote " + recordCounter + " new records")}
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

        return NPCinfo;
    }

    PO.getUserForcedAssignment = function(NPCinfo, forcedNPCAssignments, linkedNPCgroup)
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

    PO.assignNPCheight = function(NPCrecordHandle, NPCinfo, bEnableConsistency, consistencyRecords, heightSettings, userForcedAssignment, bChangeNonDefaultHeight, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCheights, NPClinkGroup, logMessage)
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

        // if NPC does belong to link group and NPC assignments are linked by name, check if the current NPC has already been matched and return its height if so
        if (NPClinkGroup === undefined && bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            heightString = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCheights)
            if (heightString != undefined)
            {
                bGenerateRandom = false;
                bHeightForced = true;
            }
        }

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

    //Logic of choosePermutation_BodyGen is as follows
    // 1:  Pick initial array of possible permutations by NPC's race and gender
    // 2a: If any of the possible permutations have "forceIf" parameters, check the NPC's specified attributes. If the NPC matches those attributes, prune the possible permutations so that only the matching permutations remain
    // 2b: If the use has specified forced subgroups for the given NPC, prune the permutations generated in step 2a so that only the matching permutations remain
    // 3a: If step 2a (if no specified forced subgroups) or 2b resulted in zero remaining permutations, the permutation choice array goes back to being defined just by the NPC's race and gender
    // 3b: If consistency is enabled, get the previous permutation from the consistency file and match it to those in the permutation choice array.
    //     If no user-forced subgroups, or if it matches all user-forced subgroups, return this permutation
    //     If it is no longer in the permutation choice array (due to a new user-forced subgroup, or because consistency was cleared), continue to step 5
    // 5:  Go through all available permutations and pick randomly until one satisfies all subgroup criteria.
    PO.choosePermutation_BodyGen = function(NPCrecordHandle, NPCinfo, permutationsByRaceGender, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, consistencyRecords, bEnableConsistency, bEnableBodyGenIntegration, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCpermutations, linkedNPCbodygen, NPClinkGroup, attributeCache, logMessage)
    {
        let bAllowOtherRGCombos = false; // keep false for now until making option in GUI. True significantly increases computation time. Variable allows forceIfAttributes and forcedSubgroups to look into permutations restricted to NPCs of a race and gender different from that of current NPC

        let bAssetsForcedByUser = false;                // for matching specific user-assigned subgroup IDs to NPCs
        let bNPCfoundInConsistencyRecords = false;      // for consistency
        let userForcedSubgroupsApplied = [];            // for matching specific user-assigned subgroup IDs to NPCs      
        let permutationToReturn = undefined;            // function output
        let permutations = [];                          // holds permutations to be searched through for a suitable choice, along with top-level subgroups to ignore for allowed/disallowedAttributes check for each permutation
        let originalpermutations = [];                  // the original permutation list; updated at the end with the NPC's info for logging purposes.
        let choiceArray = [];                           // for drawing by weighted probability
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

        // get initial permutation list from NPC's race and gender (needed even if bSkipSelection === true)
        for (let i = 0; i < permutationsByRaceGender.length; i++)
        {
            if (permutationsByRaceGender[i].race === NPCinfo.race && permutationsByRaceGender[i].gender === NPCinfo.gender)
            {
                originalpermutations = permutationsByRaceGender[i].permutations; // for logging purposes only; array does NOT get modified
                permutations = originalpermutations.slice();
            }
        } 

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
            
            // Subgroups forced by user in ForceNPCList.json
            
            userForcedSubgroupsApplied = filterPermutationsByUserForceList(permutations, permutationsByRaceGender, userForcedAssignment, bAssetsForcedByUser, logMessage, NPCinfo, bAllowOtherRGCombos);
            
            // ForceIfAttributes - prune out permutations that aren't forced for this NPC, if the NPC has the given attribute
            filterPermutationsbyForceIfAttributes(NPCrecordHandle, userForcedSubgroupsApplied, NPCinfo, permutations, logMessage, xelib, attributeCache);
            // if ForceIf attributes applied, then ignore subgroup.distributionEnabled in bPermutationValidForCurrentNPC

            // CONSISTENCY:
            permutationToReturn = drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, userForcedSubgroupsApplied, bAssetsForcedByUser, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, xelib, logMessage, attributeCache);
            if (permutationToReturn != undefined) 
            { 
                bSkipRandomSelection = true;
            }
            
            // if consistency doesn't return a permutation, proceed below to generate randomly

            //RANDOM SELECTION
            if (bSkipRandomSelection === false)
            {
                choiceArray = generatePermutationChoiceArray(permutations);
                permutationToReturn = chooseRandomPermutation(permutations, choiceArray, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, userForcedSubgroupsApplied, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, failureModes, xelib, logMessage, attributeCache);
            }
        }

        // Assign the chosen permutation to all relevant data lists
        if (choiceArray.length === 0 && permutationToReturn === undefined)
        {
            logMessage("\nAsset Assignment: no permutations satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). Skipping this NPC.");
            logMessage(Aux.formatFailureModeString(failureModes, "permutation"));
            permutationToReturn = undefined;          

            if (bEnableConsistency === true)
            {
                updatePermutationConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], permutationToReturn); // clears out the consistency
            }

            return undefined;
        }
        else 
        {
            addAssignedNPCtoPermutation(originalpermutations, permutationToReturn, NPCinfo); // store for the permutation log
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

    PO.generatePatchableGenderList = function(permutations)
    {
        let genders = [];

        for (let i = 0; i < permutations.length; i++)
        {
            if (genders.includes(permutations[i].gender.toLowerCase()) === false)
            {
                genders.push(permutations[i].gender.toLowerCase());
            }

            if (genders.includes("male") && genders.includes("female"))
            {
                break; // no reason to keep searching
            }
        }

        return genders;
    };

    PO.generateRaceEDIDFormIDdict = function(loadRecords)
    {
        let dict = {};

        let EDID = "";
        let formID = "";

        dict.allEDIDs = [];
        dict.allFormIDs = [];

        let raceHandles = loadRecords('RACE');

        for (let i = 0; i < raceHandles.length; i++)
        {
            EDID = xelib.EditorID(raceHandles[i]);
            formID = xelib.GetHexFormID(raceHandles[i]);

            dict[EDID] = formID;
            dict[formID] = EDID;

            dict.allEDIDs.push(EDID);
            dict.allFormIDs.push(formID);
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

        let overrides = xelib.GetOverrides(NPCrecord);
        let ORfileName = "";

        for (let i = 0; i < overrides.length; i++)
        {
            ORfileName = xelib.GetFileName(xelib.GetElementFile(overrides[i]));

            for (let j = 0; j < BlockedPlugins.length; j++)
            {
                if (ORfileName === BlockedPlugins[j].name)
                {
                    writeString += "NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked by Plugin (" + ORfileName + ") from: "
                    if (BlockedPlugins[j].bBlockAssets === true)
                    {
                        blockInfo.assets = true;
                        writeString += "Assets "
                    }

                    if (BlockedPlugins[j].bBlockHeight === true)
                    {
                        blockInfo.height = true;
                        writeString += "Height "
                    }

                    if (BlockedPlugins[j].bBlockBodyGen === true)
                    {
                        blockInfo.bodygen = true;
                        writeString += "BodyGen"
                    }     
                }
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

// this function writes recordTemplates (loaded from JSON and modified as instructed by permutations) to the ESP file.
// it is different from the one in ObjectToRecord.js because it allows for other record objects to be referenced dynamically
function chooseRandomPermutation(permutations, choiceArray, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, userForcedSubgroupsApplied, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let bValidChoice = false;
    let arrChoice; // index of the choice in the choice array (which can have multiple instances of any given permutation due to the probabilityWeighting)
    let choice; // index of the choice within the permutations array
    let validPermutations_withoutConsistency = []; // cache of valid permutations (for storing permutations that themselves conform to NPC's requirements, but do not pair with any BodyGen morphs). Must be compatible with the BodyGen morph stored in consistency
    let validPermutations_withoutBodyGen = [];
    let chosenMorph;
    let chosenMorph2;
    let permutationToReturn;

    // new vars
    let bConsistencyMorphExists = NPCinfo.consistencyIndex >= 0 && consistencyRecords[NPCinfo.consistencyIndex] !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined;
    let bPermutationMorphConflict = false;

    while (bValidChoice === false && choiceArray.length > 0)
    {
        arrChoice = Math.floor(Math.random() * choiceArray.length); // pick a number at random between 0 and # of permutatons.
        choice = choiceArray[arrChoice]
        permutationToReturn = permutations[choice];
        bValidChoice = bPermutationValidForCurrentNPC(NPCrecordHandle, permutationToReturn, userForcedSubgroupsApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache);
        // get rid of all instances of the given choice (recall that there can be multiple instances due to the probabilityWeighting of the permutation)
        for (let i = 0; i < choiceArray.length; i++)
        {
            if (choiceArray[i] === choice)
            {
                choiceArray.splice(i, 1);
                i--;
            }
        }

        // Get BodyGen for current permutation
        if (bValidChoice === true)
        {
            if (bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false)
            {
                validPermutations_withoutBodyGen.push(permutationToReturn);

                // is the chosen permutation compatible with the consistency morph?
                chosenMorph = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, permutationToReturn, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, attributeCache, logMessage);
                
                // if there is no consistency morph for this NPC AND the selected morph is valid, OR if if there is a consistency morph for this NPC and the morph is the consistency morph, immediately store the morph and return
                if ((bConsistencyMorphExists === false && chosenMorph !== undefined) || (bConsistencyMorphExists === true && chosenMorph.morphs === consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs))
                {
                    assignedBodyGen[NPCinfo.formID] = chosenMorph;
                    return permutationToReturn;
                }

                // if there is a consistency morph for this NPC and the chosen morph is NOT the consistency morph, store both as fallback options
                else if (bConsistencyMorphExists === true && chosenMorph.morphs !== consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs)
                {
                    validPermutations_withoutConsistency.push([permutationToReturn, chosenMorph]);
                }

                // if the chosen morph is undefined, look to see if a morph would be available to the NPC without the restrictions imposed by this permutation
                else if (chosenMorph === undefined)
                {
                    chosenMorph2 = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, consistencyRecords, undefined, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, attributeCache, logMessage);
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

                // if conditions to return have not yet been met, BodyGen criteria have not been satisfied so loop through other permutations
                bValidChoice = false;
            }
            else
            {
                return permutationToReturn;
            }
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
    if (bPermutationMorphConflict === true) // if there are morphs that would be available to the NPC without the permutation's restrictions, notify the user of the conflict
    {
        logMessage("\nAsset Assignment: NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with any permutation + BodyGen morph combination due to mutually conflicting restrictions. A valid permutation was assigned, but BodyGen assignment will proceed without respecting this permutation's restrictions.")
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

        if (Aux.isObject(value) === true && value.zEBDformID != undefined) // If the element's value points to another recordTemplate, insert that template's formID
        {
            // Since recordTemplates are written to the plugin in order of priority (depth), templates that don't reference other templates are written first
            // After being written they are assigned a formID, so this should never be undefined
            xelib.AddElementValue(recordHandle, prependPath + element, value.zEBDformID);
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

        else if (element.indexOf("zEBD") === 0) { continue; } // if the element is a reserved zEBD value, don't write it to the plugin

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

function bPermutationValidForCurrentNPC(NPCrecordHandle, permutation, userForcedSubgroups, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let bAttributeMatched = false;
    let tmpFailureStr = "";

    for (let i = 0; i < permutation.subgroups.length; i++) // loop through all contributing subgroups
    {
        // "Distribution enabled"
        if (permutation.subgroups[i].distributionEnabled === false && userForcedSubgroups.includes(permutation.subgroups[i].name) === false) // disallow permuation if the subgroup responsible for this trigger isn't user-forced
        {
            Aux.updateFailureModes(failureModes, "Distribution disabled for non-user-forced NPCs");
            return false;
        }

        // "Allow unique NPCs"
        if (permutation.subgroups[i].allowUnique === false && NPCinfo.isUnique === true && userForcedSubgroups.includes(permutation.subgroups[i].name) === false) // disallow permuation if the subgroup responsible for this trigger isn't user-forced
        {
            Aux.updateFailureModes(failureModes, "Distribution disallowed for unique NPCs");
            return false;
        }

        // "Allow non-unique NPCs"
        if (permutation.subgroups[i].allowNonUnique === false && NPCinfo.isUnique === false && userForcedSubgroups.includes(permutation.subgroups[i].name) === false) // disallow permuation if the subgroup responsible for this trigger isn't user-forced
        {
            Aux.updateFailureModes(failureModes, "Distribution disallowed for non-unique NPCs");
            return false;
        }

        // "Disallowed Attributes"
        for (let j = 0; j < permutation.subgroups[i].disallowedAttributes.length; j++) 
        {
            if (Aux.bAttributeMatched(permutation.subgroups[i].disallowedAttributes[j][0], permutation.subgroups[i].disallowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache)) // if current NPC matches current subgroup's disallowed attribute
            {
                // ignore if attribute is forced by user OR attribute is also a forceIf attribute
                if (!(userForcedSubgroups.includes(permutation.subgroups[i].name) || permutation.forceIfSubgroupsApplied.includes(permutation.subgroups[i].name)))
                {
                    Aux.updateFailureModes(failureModes, "NPC has disallowed attribute: (" + permutation.subgroups[i].disallowedAttributes[j][0] + ": " + permutation.subgroups[i].disallowedAttributes[j][1] + ") (imposed by subgroup " + permutation.subgroups[i].id + ")");
                    return false;
                }

            }
        }
        
        // "Allowed Attributes"
        tmpFailureStr = "NPC lacks any of the following allowed attributes:\n";
        for (let j = 0; j < permutation.subgroups[i].allowedAttributes.length; j++) 
        {
            bAttributeMatched = Aux.bAttributeMatched(permutation.subgroups[i].allowedAttributes[j][0], permutation.subgroups[i].allowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache);
            if (bAttributeMatched === true)
            {
                break;
            }
            else
            {
                tmpFailureStr += " (" + permutation.subgroups[i].allowedAttributes[j][0] + ": " + permutation.subgroups[i].allowedAttributes[j][1] + ")\n"
            }
        }
        if ((permutation.subgroups[i].allowedAttributes.length > 0 && bAttributeMatched === false) && userForcedSubgroups.includes(permutation.subgroups[i].name) === false && permutation.forceIfSubgroupsApplied.includes(permutation.subgroups[i].name) === false) // if the NPC lacks at least one of this subgroup's allowed attributes AND the subgroup is not forced by either the user or a forceIF, disallow it
        {
            tmpFailureStr += " imposed by subgroup " + permutation.subgroups[i].id;
            Aux.updateFailureModes(failureModes, tmpFailureStr);
            return false;
        }

        // "weight range"
        if (!Number.isNaN(permutation.subgroups[i].weightRange[0]) && NPCinfo.weight < permutation.subgroups[i].weightRange[0])
        {
            Aux.updateFailureModes(failureModes, "NPC weight  <  " + permutation.subgroups[i].weightRange[0].toString());
            return false;
        }
        if (!Number.isNaN(permutation.subgroups[i].weightRange[1]) && NPCinfo.weight > permutation.subgroups[i].weightRange[1])
        {
            Aux.updateFailureModes(failureModes, "NPC weight  >  " + permutation.subgroups[i].weightRange[1].toString());
            return false;
        }
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

function drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, userForcedSubgroupsApplied, bAssetsForcedByUser, userForcedAssignment, userBlockedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, xelib, logMessage, attributeCache)
{
    let failureModes = {};
    let passMessage = {};
    if (bEnableConsistency === true && bNPCfoundInConsistencyRecords === true)
    {
        let permutationToReturn = findPermutationFromConsistency(permutations, consistencyRecords[NPCinfo.consistencyIndex], userForcedAssignment);

        if (permutationToReturn === "ForcedAssignmentIncompatible")
        {
            logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be assigned consistently with the subgroups defined in ForceNPCList.json. Assigning a random permutation.");
            return undefined;
        }

        else if (permutationToReturn !== undefined && bPermutationValidForCurrentNPC(NPCrecordHandle, permutationToReturn, userForcedSubgroupsApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache) === true)
        {
            // if bodygen is enabled, make check to see if a valid morph can be drawn
            if (bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false)
            {
                let chosenMorph = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, permutationToReturn, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, attributeCache, logMessage, passMessage);
                
                // if the morph is valid and matches the consistency morph, or there is no consistency morph, return the permutation and morph

                if (chosenMorph !== undefined && (consistencyRecords[NPCinfo.consistencyIndex] === undefined || consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs === chosenMorph.morphs))
                {
                    assignedBodyGen[NPCinfo.formID] = chosenMorph;
                }

                // if the drawn morph is not the same one as in the consistency records, warn the user
                else if (consistencyRecords[NPCinfo.consistencyIndex] !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== chosenMorph.morphs)
                {
                    if (passMessage.message !== undefined)
                    {
                        logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") could not be paired with the consistency morphs because " + passMessage.message + " Keeping the consistency permutation and assigning a random BodyGen morph.");
                    }
                    else
                    {
                        logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with the BodyGen morphs specified in the consistency file. Keeping the consistency permutation and assigning a random BodyGen morph.");
                    }

                    if (chosenMorph !== undefined) // if a morph can be drawn, keep the consistency assignment and the morph
                    {
                        assignedBodyGen[NPCinfo.formID] = chosenMorph;
                    }
                
                    // if a morph could not be drawn, check if any available morphs would be valid without restrictions from the consistency permutation
                    // if the consistency permutation cannot be combined with any morphs, but there would be valid morphs without the restrictions from the consistency permutation, discard the consistency permutation and warn the user
                    // if no morphs are valid even without the restrictions from the consistency permutation, keep the consistency permutation
                    else if (BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, undefined, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, attributeCache, logMessage, passMessage) !== undefined) // true if there are morphs available without restrictions from consistency permutation
                    {
                        logMessage("\nAsset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with any BodyGen morphs for this NPC. Assigning a random permutation.");
                        permutationToReturn = undefined;
                    }
                } 
            }

            return permutationToReturn;
        } 
        
        // if a suitable permuation was not found, warn user
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
        NPCcomparatorPack = permutations[i].assetPackSettingsGeneratedFrom.trim();
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
        assignmentRecord.assignedAssetPack = chosenPermutation.assetPackSettingsGeneratedFrom;
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
            if (permutations[i].assetPackSettingsGeneratedFrom !== userForcedAssignment.forcedAssetPack)
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
                    if (otherRGPermutations.permutations[j].assetPackSettingsGeneratedFrom !== userForcedAssignment.forcedAssetPack)
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
        if (permutation.assetPackSettingsGeneratedFrom !== userForcedAssignment.forcedAssetPack)
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
        //      Permuation 2 has requirement for condition A only, and the NPC meets it
        //      Only Permutation 1 should be returned, because it is more specific to the NPC than Permuation2
        
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
