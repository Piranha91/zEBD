let Aux = require('./Auxilliary.js');

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
        NPCinfo.height = xelib.GetValue(NPCrecordHandle, "NAM6 - Height");

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
                logMessage("Consistency height for NPC "+ NPCinfo.name + " (" + NPCinfo.formID + ") is not allowed by current settings. Assigning a random height.");
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

    //Logic of choosePermutation is as follows
    // 1:  Pick initial array of possible permutations by NPC's race and gender
    // 2a: If any of the possible permutations have "forceIf" parameters, check the NPC's specified attributes. If the NPC matches those attributes, prune the possible permutations so that only the matching permutations remain
    // 2b: If the use has specified forced subgroups for the given NPC, prune the permutations generated in step 2a so that only the matching permutations remain
    // 3a: If step 2a (if no specified forced subgroups) or 2b resulted in zero remaining permutations, the permutation choice array goes back to being defined just by the NPC's race and gender
    // 3b: If consistency is enabled, get the previous permutation from the consistency file and match it to those in the permutation choice array.
    //     If no user-forced subgroups, or if it matches all user-forced subgroups, return this permutation
    //     If it is no longer in the permutation choice array (due to a new user-forced subgroup, or because consistency was cleared), continue to step 5
    // 5:  Go through all available permutations and pick randomly until one satisfies all subgroup criteria.
    PO.choosePermutation = function(NPCrecordHandle, NPCinfo, permutationsByRaceGender, consistencyRecords, bEnableConsistency, userForcedAssignment, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCpermutations, NPClinkGroup, attributeCache, logMessage)
    {
        let bAllowOtherRGCombos = false; // keep false for now until making option in GUI. True significantly increases computation time. Variable allows forceIfAttributes and forcedSubgroups to look into permutations restricted to NPCs of a race and gender different from that of current NPC

        let bAssetsForcedByUser = false;                // for matching specific user-assigned subgroup IDs to NPCs
        let bNPCfoundInConsistencyRecords = false;      // for consistency
        let bForceIfAttributesApplied = false;          // for following subgroup forceIfAttribute rules
        let bUserForcedSubgroupsApplied = false;        // for matching specific user-assigned subgroup IDs to NPCs        
        let permutationToReturn = undefined;            // function output
        let permutations = [];                          // holds permutations to be searched through for a suitable choice, along with top-level subgroups to ignore for allowed/disallowedAttributes check for each permutation
        let originalpermutations = [];                  // the original permutation list; updated at the end with the NPC's info for logging purposes.
        let choiceArray = [];                           // for drawing by weighted probability
        let failureModes = {};                          // for reporting to the user why a permutation couldn't be assigned.

        let bSkipSelection = false;                     // skip asset selection because the permutation has been pre-set by another NPC
        let bSkipRandomSelection = false;               // skip random asset selection if the permutation was found in consistency

        // matching current NPC to NPC-specific rules

        // if NPC belongs to a link group and the permutation for the group has already been assigned, use the permutation from the link group
        if (NPClinkGroup !== undefined && NPClinkGroup.permutation !== undefined)
        {
            permutationToReturn = NPClinkGroup.permutation;
            bSkipSelection = true;
        }

        // if NPC assignments are linked by name, check if the current NPC has already been matched and use its permutation if so
        if (bSkipSelection === false && bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            permutationToReturn = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCpermutations)
            if (permutationToReturn != undefined)
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
                resetPermutations(originalpermutations); // reset the properties that are changed by this function.
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
            bUserForcedSubgroupsApplied = filterPermutationsByUserForceList(permutations, permutationsByRaceGender, userForcedAssignment, bAssetsForcedByUser, logMessage, NPCinfo, bAllowOtherRGCombos);
            
            // ForceIfAttributes - prune out permutations that aren't forced for this NPC, if the NPC has the given attribute
            bForceIfAttributesApplied = filterPermutationsbyForceIfAttributes(NPCrecordHandle, bUserForcedSubgroupsApplied, NPCinfo, permutations, logMessage, xelib, attributeCache);
            // if ForceIf attributes applied, then ignore subgroup.distributionEnabled in bPermutationValidForCurrentNPC

            // CONSISTENCY:
            permutationToReturn = drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, xelib, logMessage, attributeCache);
            if (permutationToReturn != undefined) 
            { 
                bSkipRandomSelection = true;
            }
            
            // if consistency doesn't return a permutation, proceed below to generate randomly

            //RANDOM SELECTION
            if (bSkipRandomSelection === false)
            {
                choiceArray = generatePermutationChoiceArray(permutations);
                permutationToReturn = chooseRandomPermutation(permutations, choiceArray, NPCrecordHandle, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache);
            }
        }

        // Assign the chosen permutation to all relevant data lists
        if (choiceArray.length === 0 && permutationToReturn === undefined)
        {
            logMessage("Asset Assignment: no permutations satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.formID + "). Skipping this NPC.");
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

function chooseRandomPermutation(permutations, choiceArray, NPCrecordHandle, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let bValidChoice = false;
    let choice;
    let permutationToReturn;

    while (bValidChoice === false && choiceArray.length > 0)
    {
        choice = Math.floor(Math.random() * choiceArray.length); // pick a number at random between 0 and # of permutatons.
        permutationToReturn = permutations[choiceArray[choice]];
        bValidChoice = bPermutationValidForCurrentNPC(NPCrecordHandle, permutationToReturn, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache);
        choiceArray.splice(choice, 1); // remove that permutation from the list of permutations. Try again if necessary.
    }

    if (bValidChoice === false)
    {
        permutationToReturn = undefined;
    }

    return permutationToReturn;
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

        if (isObject(value) === true && value.zEBDformID != undefined) // If the element's value points to another recordTemplate, insert that template's formID
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

        else if (isObject(value) === true && value.zEBDformID === undefined) // if the value is an object (including array) but not an zEBD Record itself | Note that an array of flags will also be an object, so handle flags here
        {
            tmpHandle = xelib.AddElement(recordHandle, prependPath + element); // required to call IsFlags
            if (xelib.IsFlags(tmpHandle) === true) // if element points to
            {
                xelib.SetEnabledFlags(recordHandle, prependPath + element, value);
            }

            else if (Array.isArray(value) === true) // if the element value is an array
            {
                xelib.RemoveElement(recordHandle, prependPath + element);

                for (let i = 0; i < value.length; i++) // iterate through each array element
                {
                    if (value[i].zEBDformID != undefined) // if the array element's value points to another recordTemplate, push that template's formID to the array
                    {
                        xelib.AddArrayItem(recordHandle, prependPath + element, "", value[i].zEBDformID);
                    }
                    else // if the array's element value is a not another recordTemplate, recursively run this function on the value
                    {
                        xelib.AddArrayItem(recordHandle, prependPath + element, "", value[i]);  // CHECK THIS
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

function bPermutationValidForCurrentNPC(NPCrecordHandle, permutation, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache)
{
    let bValid = true;
    let attributeMatched = false;
    let failureModeString = "";

    if (permutation.distributionEnabled === false && bUserForcedSubgroupsApplied === false && bForceIfAttributesApplied === false)
    {
        failureModeString = "Distribution disabled for random NPCs";
        if (failureModes[failureModeString] === undefined)
        {
            failureModes[failureModeString] = 1;
        }
        else
        {
            failureModes[failureModeString]++;
        }
        return false;
    }
    
    if (NPCinfo.isUnique === true && permutation.allowUnique === false && bUserForcedSubgroupsApplied === false) // user-forced subgroups override the settings to patch unique NPCs
    {
        failureModeString = "Distribution disallowed for unique NPCs";
        if (failureModes[failureModeString] === undefined)
        {
            failureModes[failureModeString] = 1;
        }
        else
        {
            failureModes[failureModeString]++;
        }
        return false;
    }

    if (NPCinfo.isUnique === false && permutation.allowNonUnique === false && bUserForcedSubgroupsApplied === false)
    {
        failureModeString = "Distribution disallowed for non-unique NPCs";
        if (failureModes[failureModeString] === undefined)
        {
            failureModes[failureModeString] = 1;
        }
        else
        {
            failureModes[failureModeString]++;
        }
        return false;
    }

    // handle disallowedAttributes before allowedAttributes because it has priority
    // at this point in execution, permutation.topLevelSubgroupsSatisfied is populated only by forceIf attributes and not yet by allowedAttributes
    for (let i = 0; i < permutation.disallowedAttributes.length; i++) 
    {
        if (permutation.topLevelSubgroupsSatisfied.includes(permutation.disallowedAttributes[i].sourceSubgroupTop) === false)
        {
            attributeMatched = Aux.bAttributeMatched(permutation.disallowedAttributes[i].attribute[0], permutation.disallowedAttributes[i].attribute[1], NPCrecordHandle, logMessage, xelib, attributeCache);
            if (attributeMatched === true) 
            { 
                failureModeString = "NPC has disallowed attribute: (" + permutation.disallowedAttributes[i].attribute[0] + ": " + permutation.disallowedAttributes[i].attribute[1] + " (imposed by subgroup " + permutation.disallowedAttributes[i].sourceSubgroupID + ")";
                if (failureModes[failureModeString] === undefined)
                {
                    failureModes[failureModeString] = 1;
                }
                else
                {
                    failureModes[failureModeString]++;
                }
                return false;
            }
        }    
    }
    
    // loop through all allowedAttributes and record per-subgroup which ones are met
    for (let i = 0; i < permutation.allowedAttributes.length; i++) 
    {
        if (permutation.topLevelSubgroupsSatisfied.includes(permutation.allowedAttributes[i].sourceSubgroupTop) === false)
        {
            attributeMatched = Aux.bAttributeMatched(permutation.allowedAttributes[i].attribute[0], permutation.allowedAttributes[i].attribute[1], NPCrecordHandle, logMessage, xelib, attributeCache);
            if (attributeMatched === true) 
            { 
                permutation.topLevelSubgroupsSatisfied.push(permutation.allowedAttributes[i].sourceSubgroupTop)
            }
        }    
    }
    // loop through again and return false if the allowedAttributes for any subgroup are not met
    for (let i = 0; i < permutation.allowedAttributes.length; i++) 
    {
        if (permutation.topLevelSubgroupsSatisfied.includes(permutation.allowedAttributes[i].sourceSubgroupTop) === false)
        {
            failureModeString = "NPC lacks allowed attribute: (" + permutation.allowedAttributes[i].attribute[0] + ": " + permutation.allowedAttributes[i].attribute[1] + " (imposed by subgroup " + permutation.allowedAttributes[i].sourceSubgroupID + ")";
            if (failureModes[failureModeString] === undefined)
            {
                failureModes[failureModeString] = 1;
            }
            else
            {
                failureModes[failureModeString]++;
            }
            return false;
        }
    }

    return bValid;
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

function drawPermutationFromConsistency(NPCrecordHandle, permutations, consistencyRecords, NPCinfo, bEnableConsistency, bNPCfoundInConsistencyRecords, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, xelib, logMessage, attributeCache)
{
    let failureModes = {};
    if (bEnableConsistency === true && bNPCfoundInConsistencyRecords === true)
    {
        let permutationToReturn = findPermutationFromConsistency(permutations, consistencyRecords[NPCinfo.consistencyIndex]);
        if (permutationToReturn !== undefined && bPermutationValidForCurrentNPC(NPCrecordHandle, permutationToReturn, bUserForcedSubgroupsApplied, bForceIfAttributesApplied, NPCinfo, failureModes, xelib, logMessage, attributeCache) === true)
        {
            return permutationToReturn;
        } 
        // if a suitable permuation was not found, warn user
        else if (bUserForcedSubgroupsApplied === true)
        {
            logMessage("Asset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.formID + ") could not be assigned consistently with the subgroups defined in ForceNPCList.json.");
        }
        else
        {
            logMessage("Asset Assignment: the permutation specified in the consistency file for " + NPCinfo.name + " (" + NPCinfo.formID + ") could not be assigned. Assigning a random permutation.");
            logMessage(Aux.formatFailureModeString_consistency(failureModes, "permutation"));
        }
    }

    return undefined; // only reached if the permutation from consistency was not found or not compatible with current settings.
}

function findPermutationFromConsistency(permutations, NPCAssignment)
{
    let toReturn = undefined;
    let assignmentComparatorPack = "";
    let assignmentComparatorID = "";
    let NPCcomparatorPack = "";
    let NPCcomparatorID = "";

    assignmentComparatorPack = NPCAssignment.assignedAssetPack.trim();
    assignmentComparatorID = NPCAssignment.assignedPermutation.trim();
    for (let i = 0; i < permutations.length; i++)
    {
        NPCcomparatorPack = permutations[i].assetPackSettingsGeneratedFrom.trim();
        NPCcomparatorID = permutations[i].nameString.trim();
        if (assignmentComparatorPack === NPCcomparatorPack && assignmentComparatorID === NPCcomparatorID)
        {
            toReturn = permutations[i];
            break;
        }
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
    let bUserForcedAttributesApplied = false;
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

            else if (permutationAllowedByUserForceList(userForcedAssignment.forcedSubgroups, permutations[i]) === true) // otherwise check if the user allowed that subgroup
            {
                for (let j = 0; j < userForcedAssignment.forcedSubgroups.length; j++)
                {
                    permutations[i].topLevelSubgroupsSatisfied.push(userForcedAssignment.forcedSubgroups[j].topLevelSubgroup);
                }
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
                    else if (permutationAllowedByUserForceList(userForcedAssignment.forcedSubgroups, otherRGPermutations.permutations[j]) === true)
                    {
                        userForcedPermutations.push(otherRGPermutations.permutations[j]);
                    }
                }
            }
        }

        // warn user if no compliant permutations found
        if (userForcedPermutations.length === 0)
        {
            logMessage("Asset Assignment: no generated permutations comply with the subgroups forced in ForceNPCList.json for " + NPCinfo.name + " (" + NPCinfo.formID + "). Assigning a random permutation.");
        }
        else
        {
            Aux.replaceArrayValues(permutations, userForcedPermutations); // replace the values within permutations by reference so that it returns to the calling function (reminder that simply setting it to = breaks the reference
            bUserForcedAttributesApplied = true;
        }
    }
    return bUserForcedAttributesApplied;
}

function filterPermutationsbyForceIfAttributes(NPCrecordHandle, bUserForcedSubgroupsApplied, NPCinfo, permutations, logMessage, xelib, attributeCache)
{
    let bpermutationIsForcedForThisNPC = false;
    let bForceIfAttributesApplied = false;
    let bNPCmatches = false;
    let forcedpermutations = [];
    let filteredpermutations = [];
    // track unique top-level subgroups specified by forceIfAttributes to determine the specificity of the permutations and filter for the most specific ones
    let uniqueForceIfTopLevelSubgroups = [];
    let uniqueForceIfTopLevelSubgroupCounts = [];
    let maxUniqueForceIfConditionsFound = 0;

    for (let i = 0; i < permutations.length; i++)
    {
        bpermutationIsForcedForThisNPC = false;
        uniqueForceIfTopLevelSubgroups = [];

        if (permutations[i].forceIfAttributes.length > 0)
        {
            for (let j = 0; j < permutations[i].forceIfAttributes.length; j++)
            {
                bNPCmatches = Aux.bAttributeMatched(permutations[i].forceIfAttributes[j].attribute[0], permutations[i].forceIfAttributes[j].attribute[1], NPCrecordHandle, logMessage, xelib, attributeCache);
                if (bNPCmatches === true)
                {
                    bpermutationIsForcedForThisNPC = true;
                    permutations[i].topLevelSubgroupsSatisfied.push(permutations[i].forceIfAttributes[j].sourceSubgroupTop);
                    
                    if (uniqueForceIfTopLevelSubgroups.includes(permutations[i].forceIfAttributes[j].sourceSubgroupTop) === false)
                    {
                        uniqueForceIfTopLevelSubgroups.push(permutations[i].forceIfAttributes[j].sourceSubgroupTop);
                    }
                }
            }
        }

        if (bpermutationIsForcedForThisNPC === true && bPermutationValidForCurrentNPC(NPCrecordHandle, permutations[i], bUserForcedSubgroupsApplied, true, NPCinfo, {}, xelib, logMessage, attributeCache) === true)
        {
            forcedpermutations.push(permutations[i]);
            uniqueForceIfTopLevelSubgroupCounts.push(uniqueForceIfTopLevelSubgroups.length); // track how many unique top-level subgroup requirements are satisfied by the given permutation
            
            if (uniqueForceIfTopLevelSubgroups.length > maxUniqueForceIfConditionsFound)
            {
                maxUniqueForceIfConditionsFound = uniqueForceIfTopLevelSubgroups.length;
            }
        }
    }

    if (forcedpermutations.length > 0) // this is only true if the NPC's attributes matched a forceIfAttribute of at least one permutation
    {
        // prune the forceIf permutations to the ones that satisfy the highest number of forceIf conditions:
        // E.G: Permutation1 has requirement for condition A and condition B, and NPC meets both
        //      Permuation 2 has requirement for condition A only, and the NPC meets it
        //      Only Permutation 1 should be returned, because it is more specific to the NPC than Permuation2
        
        for (let i = 0; i < forcedpermutations.length; i++)
        {
            if (uniqueForceIfTopLevelSubgroupCounts[i] === maxUniqueForceIfConditionsFound) // uniqueForceIfTopLevelSubgroupCounts has the same indices as forcedpermutations because they're pushed on the same condition
            {
                filteredpermutations.push(forcedpermutations[i]);
            }
        }

        Aux.replaceArrayValues(permutations, filteredpermutations); // replace the values within permutations by reference so that it returns to the calling function (reminder that simply setting it to = breaks the reference)

        bForceIfAttributesApplied = true; // returned by value
    }

    return bForceIfAttributesApplied;
}


// this function returns true if each of the user-forced subgroups are contained within the given permutation
function permutationAllowedByUserForceList(forcedSubgroups, permutation)
{
    for (let i = 0; i < forcedSubgroups.length; i++)
    {
        if (bPermutationContributingSubgroupIDsContain(permutation, forcedSubgroups[i].id) === false)
        {
            return false;
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

function resetPermutations(permutations)
{
    for (let i = 0; i < permutations.length; i++)
    {
        permutations[i].topLevelSubgroupsSatisfied = [];
        permutations[i].overrideRaceRestrictions = false;
    }
}


// Auxilliary Code Block
function isObject(val) {
    if (val === null) { return false;}
    return (typeof val === 'object');
}

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
