debugger;

module.exports = function(Aux, PO)
{
    let BGI = {};

    BGI.assignMorphs = function(NPCrecordHandle, BGconfig, categorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, assignedAssetPermutation, userForcedAssignment, bLinkNPCsWithSameName, LinkedNPCNameExclusions, linkedNPCBodyGen, NPClinkGroup, attributeCache, logMessage)
    {
        let returnObj = {};
        let assignedMorphs = [];
        let assignedGroups = [];
        let combinations;
        let combinationIndex;
        let combination;
        let item;
        let selectionList;

        let bFoundValidCombination = false;
        let bFoundValidMorph = false;
        let bForcedValid = true;

        let bLinkedMorphsValid = true;
        let bLinkedMorphsLoaded = false;
        let linkedData = {};

        let morphs;
        let morphListForGroup;
        let chosenIndex;
        let chosenMorph;

        let filteredItems = [];
        let userForcedMorphs = [];
        let userForcedMorphsConsistencyTracker = [];

        let failureModes = {};

        if (NPClinkGroup !== undefined && NPClinkGroup.morphs !== undefined && NPClinkGroup.groups !== undefined)
        {
            assignedMorphs = NPClinkGroup.morphs;
            assignedGroups = NPClinkGroup.groups;
            bLink = false;
            bLinkedMorphsLoaded = true;
            bFoundValidCombination = true;
        }

        // set up lists to select from
        let m = categorizedMorphs[NPCinfo.gender][NPCinfo.race];
        if (m === undefined || angular.equals(m, {}))
        {
            // no match for this race and gender
            return;
        }
        else
        {
            morphs = angular.copy(m); // deep copy to allow pruning
        }

        switch(NPCinfo.gender)
        {
            case "female": 
                combinations = getCombinations(NPCinfo.race, BGconfig.racialSettingsFemale); // shallow copy - can edit
                break;
            case "male": 
                combinations = getCombinations(NPCinfo.race, BGconfig.racialSettingsMale); // shallow copy - can edit
                break;
        }
        
        // filter combinations by user forced list
        combinations = filterCombinationsByUserForceList(userForcedAssignment, combinations, morphs, NPCinfo, logMessage);

        // filter morphs by user forced list
        userForcedMorphs = filterMorphsByUserForceList(userForcedAssignment, morphs);
        userForcedMorphsConsistencyTracker = userForcedMorphs.slice();

        // if NPC assignments are linked by name, check if the current NPC has already been matched and return its BodyGen
        if (bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            bLinkedMorphsValid = true;
            linkedData = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCBodyGen);
            if (linkedData !== undefined && linkedData.assignedMorphs.length > 0 && linkedData.assignedGroups.length > 0)
            {
                assignedMorphs = linkedData.assignedMorphs;
                assignedGroups = linkedData.assignedGroups;
                
                for (let i = 0; i < assignedMorphs.length; i++)
                {
                    if (userForcedMorphs.includes(assignedMorphs[i]) === false)
                    {
                        bLinkedMorphsValid = false;
                        break;
                    }
                }

                if (assignedMorphs !== undefined && assignedGroups.length > 0 && bLinkedMorphsValid.length > 0)
                {
                    bFoundValidCombination = true;
                    bLinkedMorphsLoaded = true;
                }
            }
        }

        // load from consistency
        if (bEnableConsistency === true && NPCinfo.consistencyIndex > -1 && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined && bLinkedMorphsLoaded === false)
        {
            for (let i = 0; i < consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs.length; i++)
            {
                chosenMorph = getMorphByName(morphs, consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs[i]);
                assignedGroup = consistencyRecords[NPCinfo.consistencyIndex].assignedGroups[i];
                morphListForGroup = morphs[assignedGroup];

                if (chosenMorph === undefined)
                {
                    bForcedValid = false;
                    logMessage("BodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.formID + ") was not found. Choosing at random.");
                    break;
                }

                if (bMorphIsValid(NPCrecordHandle, NPCinfo, chosenMorph, morphListForGroup, assignedAssetPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage) === false)
                {
                    bForcedValid = false;
                    logMessage("BodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.formID + ") is invalid according to current settings. Choosing at random.");
                    logMessage(Aux.formatFailureModeString_consistency(failureModes, "morph"));
                    break;
                }

                if (userForcedMorphsConsistencyTracker.includes(chosenMorph.name))
                {
                    userForcedMorphsConsistencyTracker.splice(userForcedMorphsConsistencyTracker.indexOf(chosenMorph.name));
                }
            }
            
            // check to make sure all user forced morphs have been assigned
            if (userForcedMorphs.length > 0 && userForcedMorphsConsistencyTracker.length > 0)
            {
                logMessage("BodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.formID + ") does not comply with your Specific NPC Assignments.");
                bForcedValid = false;
            }

            if (bForcedValid === true && assignedMorphs.length > 0)
            {
                assignedMorphs = consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs;
                assignedGroups = consistencyRecords[NPCinfo.consistencyIndex].assignedGroups;
                bFoundValidCombination = true;
            }
        }

        // random generation
        while (bFoundValidCombination === false && combinations.length > 0) // note: The tracked parameter here is combinations
        {
            assignedMorphs = []; // reset the assigned morph list if picking a new combination
            assignedGroups = []; // reset the assigned group list if picking a new combination

            // randomly choose a valid combination for this NPC (e.g. top+bottom)
            combinationIndex = chooseRandomFromProbabilityWeighting(combinations);
            combination = combinations[combinationIndex].members;

            for (let i = 0; i < combination.length; i++)  // choose a morph for each item in the combination
            {
                item = combination[i]; // e.g. "top" or "bottom"

                if (filteredItems.includes(item) === false) // filteredItems simply logs that the given group within the morph list has already been filtered by ForceIF and doesn't need to be filtered again
                {
                    morphs[item] = filterMorphsByForceIf(NPCrecordHandle, NPCinfo, morphs[item], assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage);
                    filteredItems.push(item);
                }

                selectionList = morphs[item];

                // choose random morph that belongs to the current group
                bFoundValidMorph = false;
                while (bFoundValidMorph === false && selectionList.length > 0) // note: The tracked parameter here is selectionList
                {
                    chosenIndex = chooseRandomFromProbabilityWeighting(selectionList);
                    chosenMorph = selectionList[chosenIndex];

                    bFoundValidMorph = bMorphIsValid(NPCrecordHandle, NPCinfo, chosenMorph, morphs[item], assignedAssetPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage);

                    if (bFoundValidMorph === true)
                    {
                        assignedMorphs.push(chosenMorph.name);
                        assignedGroups.push(item);

                        if (i === combination.length - 1)
                        {
                            bFoundValidCombination = true;
                        }
                    }
                    else
                    {
                        selectionList.splice(chosenIndex, 1);
                    }
                }
                if (selectionList.length === 0) // if there are no valid morphs for the current group within the current combination:
                {
                    //  purge any combination that contains this group
                    for (let i = 0; i < combinations.length; i++)
                    {
                        if (combinations[i].members.includes(item) === true)
                        {
                            combinations.splice(i, 1);
                        }
                    }
                    break; // out of the current combination controlled by iterator i
                }
            }
        }


        // consistency and return
        if (bFoundValidCombination === true)
        {
            if (bEnableConsistency === true)
            {
                if (NPCinfo.consistencyIndex === -1) // if no record of this NPC exists in the consistency file, create one
                {
                    Aux.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib) // NPCinfo.consistencyIndex gets updated here
                } 
                updateBodyGenConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], assignedMorphs, assignedGroups);
            }
            
            linkedData = {};
            linkedData.assignedMorphs = assignedMorphs;
            linkedData.assignedGroups = assignedGroups;
            Aux.updatelinkedDataArray(bLinkNPCsWithSameName, NPCinfo, linkedData, LinkedNPCNameExclusions, linkedNPCBodyGen);

            if (NPClinkGroup !== undefined && NPClinkGroup.morphs === undefined && NPClinkGroup.groups === undefined)
            {
                NPClinkGroup.morphs = assignedMorphs;
                NPClinkGroup.groups = assignedGroups;
            }

            returnObj.morphs = assignedMorphs;
            returnObj.rootPlugin = NPCinfo.masterRecordFile;
            returnObj.ID = generateBodyGenID(NPCinfo.formID);
            return returnObj;
        }

        else
        {
            logMessage("BodyGen Assignment: no BodyGen morphs satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.formID + "). Skipping this NPC.");
            logMessage(Aux.formatFailureModeString(failureModes, "morph"));

            if (bEnableConsistency === true)
            {
                updateBodyGenConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], undefined);
            }
            return undefined;
        }
    }

    BGI.categorizeMorphs = function(config, restrictionGroupDefs) 
    {
        let currentMorph;
        let morphList = [];

        let BGmorphs = {};
        let groupList = [];

        let sortedList;
        let currentGroup = "";

        // set up genders
        BGmorphs.female = {};
        BGmorphs.male = {};
        
        // set up races and groups
        for (let i = 0 ; i < config.racialSettingsFemale.length; i++)
        {
            BGmorphs.female[config.racialSettingsFemale[i].EDID] = {};
            groupList = [];
            for (let j = 0; j < config.racialSettingsFemale[i].combinations.length; j++)
            {
                for (let k = 0; k < config.racialSettingsFemale[i].combinations[j].members.length; k++)
                {
                    if (groupList.includes(config.racialSettingsFemale[i].combinations[j].members[k]) === false)
                    {
                        groupList.push(config.racialSettingsFemale[i].combinations[j].members[k]);
                    }
                }
            }

            for (let j = 0; j < groupList.length; j++)
            {
                BGmorphs.female[config.racialSettingsFemale[i].EDID][groupList[j]] = [];
            }
        }

        for (let i = 0 ; i < config.racialSettingsMale.length; i++)
        {
            BGmorphs.male[config.racialSettingsMale[i].EDID] = {};
            groupList = [];
            for (let j = 0; j < config.racialSettingsMale[i].combinations.length; j++)
            {
                for (let k = 0; k < config.racialSettingsMale[i].combinations[j].members.length; k++)
                {
                    if (groupList.includes(config.racialSettingsMale[i].combinations[j].members[k]) === false)
                    {
                        groupList.push(config.racialSettingsMale[i].combinations[j].members[k]);
                    }
                }
            }

            for (let j = 0; j < groupList.length; j++)
            {
                BGmorphs.male[config.racialSettingsMale[i].EDID][groupList[j]] = [];
            }
        }

        // copy morphs so they can be edited without altering the config file
        for (let i = 0; i < config.templates.length; i++)
        {
            morphList.push(angular.copy(config.templates[i]));
        }

        // set up morphs
        for (let i = 0; i < morphList.length; i++)
        {
            currentMorph = morphList[i];

            if (currentMorph.allowedRaces.length > 0)
            {
                currentMorph.allowedRaces = Aux.replaceGroupDefWithIndividuals(currentMorph.allowedRaces, restrictionGroupDefs);
            }

            if (currentMorph.disallowedRaces.length > 0)
            {
                currentMorph.disallowedRaces = Aux.replaceGroupDefWithIndividuals(currentMorph.disallowedRaces, restrictionGroupDefs);
            }

            switch(currentMorph.gender)
            {
                case "female": sortedList = BGmorphs.female; break;
                case "male": sortedList = BGmorphs.male; break;
            }

            for (let race in sortedList)
            {
                if ((currentMorph.allowedRaces.length === 0 || currentMorph.allowedRaces.includes(race)) && currentMorph.disallowedRaces.includes(race) === false)
                {
                    for (let j = 0; j < currentMorph.groups.length; j++)
                    {
                        currentGroup = currentMorph.groups[j];
                        if (bRaceIncludesGroup(sortedList[race], currentGroup))
                        {
                            sortedList[race][currentGroup].push(currentMorph);
                        }
                    }
                }
            }
        }

        return BGmorphs;
    }

    BGI.formatMorphDescriptors = function(templateList)
    {
        let obj = {};
        let tmpArray = [];
        let split = [];
        for (let i = 0; i < templateList.length; i++)
        {
            tmpArray = [];
            for (let j = 0; j < templateList[i].descriptors.length; j++)
            {
                obj = {};
                split = templateList[i].descriptors[j].split(':');
                obj.category = split[0].trim();
                obj.value = split[1].trim();
                tmpArray.push(obj);
            }
            templateList[i].descriptors = tmpArray;
        }
    }

    // Ended up deciding not to use this function, but leaving it as a resource in case I come back to it in future versions.
    BGI.getAllRaceGenderMorphs = function(bodyGenConfig, categorizedMorphs, patchableRaces)
    {
        let allRGMorphs = {};
        allRGMorphs["male"] = {};
        allRGMorphs["female"] = {};
        let combinations;
        let morphs;
        let morphCombo = [];

        let morphVariants = [];

        for (let i = 0; i < patchableRaces.length; i++)
        {
            if (allRGMorphs["male"][patchableRaces[i]] === undefined)
            {
                allRGMorphs["male"][patchableRaces[i]] = [];
            }
            if (allRGMorphs["female"][patchableRaces[i]] === undefined)
            {
                allRGMorphs["female"][patchableRaces[i]] = [];
            }

            combinations = getCombinations(patchableRaces[i], bodyGenConfig.racialSettingsFemale);
            if (combinations !== undefined)
            {
                morphs = categorizedMorphs["female"][patchableRaces[i]];

                for (let j = 0; j < combinations.length; j++)
                {
                    morphCombo = [];
                    for (let k = 0; k < combinations[j].members.length; k++)
                    {
                        morphCombo.push(morphs[combinations[j].members[k]]);
                    }
                    if (morphCombo.length > 1)
                    {
                        morphVariants = buildMorphPermutations(morphCombo);
                        allRGMorphs["female"][patchableRaces[i]].push(...morphVariants);
                    }
                    else
                    {
                        for (let k = 0; k < morphCombo[0].length; k++)
                        {
                            if (morphCombo[0][k].allowRandom === true) // trim out non-distributable morphs
                            {
                                allRGMorphs["female"][patchableRaces[i]].push([morphCombo[0][k]]);
                            }
                        }
                    }
                }
            }

            combinations = getCombinations(patchableRaces[i], bodyGenConfig.racialSettingsMale);
            if (combinations !== undefined)
            {
                morphs = categorizedMorphs["male"][patchableRaces[i]];

                for (let j = 0; j < combinations.length; j++)
                {
                    morphCombo = [];
                    for (let k = 0; k < combinations[j].members.length; k++)
                    {
                        morphCombo.push(morphs[combinations[j].members[k]]);
                    }
                    if (morphCombo.length > 1)
                    {
                        morphVariants = buildMorphPermutations(morphCombo);
                        allRGMorphs["male"][patchableRaces[i]].push(...morphVariants);
                    }
                    else
                    {
                        for (let k = 0; k < morphCombo[0].length; k++)
                        {
                            if (morphCombo[0][k].allowRandom === true) // trim out non-distributable morphs
                            {
                                allRGMorphs["male"][patchableRaces[i]].push([morphCombo[0][k]]);
                            }
                        }
                    }
                }
            }
        }

        return allRGMorphs;
    }

    return BGI;

    function buildMorphPermutations(morphCombos)
    {
        let combinations = [];
        let combination = [];
        let otherItems = [];
        if (morphCombos.length === 2)
        {
            otherItems = morphCombos[1];
        }
        else
        {
            otherItems = buildMorphPermutations(morphCombos.slice(1, morphCombos.length));
        }

        for (let i = 0; i < morphCombos[0].length; i++)
        {
            
            for (let j = 0; j < otherItems.length; j++)
            {
                combination = [];
                combination.push(morphCombos[0][i]);
                if (Array.isArray(otherItems[j]))
                {
                    combination.push(...otherItems[j]);
                }
                else
                {
                    combination.push(otherItems[j]);
                }    
                combinations.push(combination);
            }
            
        }
        
        // get rid of non-distributable combinations

        let cull = false;
        for (let i = 0; i < combinations.length; i++)
        {
            for (let j = 0; j < combinations[i].length; j++)
            {
                if (combinations[i][j].allowRandom === false)
                {
                    cull = true; 
                    break;
                }
            }
            if (cull === true)
            {
                combinations.splice(i, 1);
                i--;
            }
        }

        return combinations;
    }

    function bMorphIsValid(NPCrecordHandle, NPCinfo, morph, morphList, chosenPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage)
    {
        let bAAsatisfied = false;

        if (userForcedMorphs.includes(morph.name))
        {
            return true;
        }
        else if (morph.allowRandom === false)
        {
            failureModeString = "Distribution disallowed to non-user-specified NPCs";
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

        // check allowed BodyGen descriptors from permutation
        if (chosenPermutation !== undefined && chosenPermutation.allowedBodyGenDescriptors !== undefined)
        {
            for (let category in chosenPermutation.allowedBodyGenDescriptors)
            {
                if (bMorphListIncludesDescriptorCategory(morphList, category) === true && bMorphDescriptorsIncludesCurrent(morph, category, chosenPermutation.allowedBodyGenDescriptors[category]) === false)
                {
                    failureModeString = "Morph's descriptors for \"" + category + "\" don't match those allowed by the chosen permutation (" + chosenPermutation.allowedBodyGenDescriptors[category].join() + ")";
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

        // check disallowed BodyGen descriptors from permutation
        if (chosenPermutation !== undefined && chosenPermutation.disallowedBodyGenDescriptors !== undefined)
        {
            for (let i = 0; i < chosenPermutation.disallowedBodyGenDescriptors.length; i++)
            {
                for (let j = 0; j < morph.descriptors.length; j++)
                {
                    if (chosenPermutation.disallowedBodyGenDescriptors[i].category === morph.descriptors[j].category && chosenPermutation.disallowedBodyGenDescriptors[i].value === morph.descriptors[j].value)
                    {
                        failureModeString = "Morph's descriptor " + chosenPermutation.disallowedBodyGenDescriptors[i].value + " is disallowed by the chosen permutation";
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
        }

        // check allowedAttributes from morph

        if (morph.allowedAttributes.length > 0)
        {
            for (let i = 0; i < morph.allowedAttributes.length; i++)
            {
                bAAsatisfied = Aux.bAttributeMatched(morph.allowedAttributes[i][0], morph.allowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache);
                if (bAAsatisfied === true)
                {
                    break;
                }
            }

            if (bAAsatisfied === false)
            {
                failureModeString = "NPC lacks allowed attribute: (" + morph.allowedAttributes[i][0] + ": " + morph.allowedAttributes[i][1];
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

        // check disallowedAttributes from morph
        for (let i = 0; i < morph.disallowedAttributes.length; i++)
        {
            if (Aux.bAttributeMatched(morph.disallowedAttributes[i][0], morph.disallowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true)
            {
                failureModeString = "NPC has disallowed attribute: (" + morph.disallowedAttributes[i][0] + ": " + morph.disallowedAttributes[i][1];
                return false;
            }
        }

        if (NPCinfo.isUnique === true && morph.allowUnique === false)
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
        else if (NPCinfo.isUnique === false && morph.allowNonUnique === false)
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

        return true;
    }

    function chooseRandomFromProbabilityWeighting(items)
    {
        let choiceList = [];
        for (let i = 0; i < items.length; i++)
        {
            for (let j = 0; j < items[i].probabilityWeighting; j++)
            {
                choiceList.push(i);
            }
        }

        let randomChoice = Math.floor(Math.random() * choiceList.length);
        return choiceList[randomChoice];
    }

    function filterMorphsByForceIf(NPCrecordHandle, NPCinfo, morphList, assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage)
    {
        let forcedMorphsPass1 = [];
        let forcedMorphsFinal = [];
        let maxAttributesMatched = 0;
        let currentAttributesMatched = 0;

        for (let i = 0; i < morphList.length; i++)
        {
            currentAttributesMatched = 0;
            if (morphList[i].forceIfAttributes.length > 0)
            {
                for (let j = 0; j < morphList[i].forceIfAttributes.length; j++)
                {
                    if (Aux.bAttributeMatched(morphList[i].forceIfAttributes[i][0], morphList[i].forceIfAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true && bMorphIsValid(NPCrecordHandle, NPCinfo, morphList[i], morphList, assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage) === true)
                    {
                        currentAttributesMatched++;
                    }
                }

                if (currentAttributesMatched > 0)
                {
                    forcedMorphsPass1.push([morphList[i], currentAttributesMatched]);
                }

                if (currentAttributesMatched > maxAttributesMatched)
                {
                    maxAttributesMatched = currentAttributesMatched;
                }
            }
        }

        if (maxAttributesMatched === 0)
        {
            return morphList;
        }
        else
        {
            for (let i = 0; i < forcedMorphsPass1.length; i++)
            {
                if (forcedMorphsPass1[i][1] === maxAttributesMatched)
                {
                    forcedMorphsFinal.push(forcedMorphsPass1[i][0]);
                }
            }
            return forcedMorphsFinal;
        }
    }

    function filterCombinationsByUserForceList(userForcedAssignment, combinations, morphs, NPCinfo, logMessage)
    {
        let bAllForcedMorphsMet = false;
        let bCurrentForcedMorphMet = false;
        let userForcedCombinations = [];
        
        if (userForcedAssignment !== undefined && userForcedAssignment.forcedBodyGenMorphs !== undefined && userForcedAssignment.forcedBodyGenMorphs.length > 0)
        {
            // look through each combination
            for (let i = 0; i < combinations.length; i++)
            {
                bAllForcedMorphsMet = true;
                // look through each forced morph
                for (let j = 0; j < userForcedAssignment.forcedBodyGenMorphs.length; j++)
                {
                    bCurrentForcedMorphMet = false;
                    forcedMorph = userForcedAssignment.forcedBodyGenMorphs[j];
                    // look through each category within the current combination
                    for (let k = 0; k < combinations[i].members.length; k++)
                    {
                        // check for match
                        if (bMorphGroupHasName(combinations[i].members[k], morphs, forcedMorph) === true)
                        {
                            bCurrentForcedMorphMet = true;
                            break;
                        }
                    }
                    if (bCurrentForcedMorphMet === false) // this is false if the current morph (iterated by loop j) was not found in ANY member of the current combination (iterated by loop i)
                    {
                        bAllForcedMorphsMet = false;
                    }
                }
                if (bAllForcedMorphsMet === true)
                {
                    userForcedCombinations.push(combinations[i]);
                }
            }

            if (userForcedCombinations.length > 0)
            {
                combinations = userForcedCombinations;
            }
            else
            {
                logMessage("BodyGen Assignment: could not find a BodyGen Template Group Combination that contained all forced morphs for " + NPCinfo.name + " (" + NPCinfo.formID + "). Choosing morphs at random.")
            }
        }

        return combinations;
    }

    function filterMorphsByUserForceList(userForcedAssignment, morphs)
    {
        let userForcedMorphs = [];
        let forcedMorph;

        if (userForcedAssignment !== undefined && userForcedAssignment.forcedBodyGenMorphs !== undefined)
        {
            for (let i = 0; i < userForcedAssignment.forcedBodyGenMorphs.length; i++)
            {
                for (let group in morphs)
                {
                    if (bMorphGroupHasName(group, morphs, userForcedAssignment.forcedBodyGenMorphs[i]) === true)
                    {
                        userForcedMorphs.push(userForcedAssignment.forcedBodyGenMorphs[i]);
                        forcedMorph = getMorphByName(morphs, userForcedAssignment.forcedBodyGenMorphs[i]);
                        morphs[group] = [forcedMorph];
                    }
                }
            }
        }

        return userForcedMorphs;
    }

    function bMorphListIncludesDescriptorCategory(morphList, category)
    {
        for (let i = 0; i < morphList.length; i++)
        {
            for (let j = 0; j < morphList[i].descriptors.length; j++)
            {
                if (morphList[i].descriptors[j].category === category)
                {
                    return true;
                }
            }
        }
        return false;
    }

    function bMorphDescriptorsIncludesCurrent(morph, category, allowedValues)
    {
        for (let i = 0; i < morph.descriptors.length; i++)
        {
            if (morph.descriptors[i].category === category && allowedValues.includes(morph.descriptors[i].value))
            {
                return true
            }
        }
        return false;
    }

    function bRaceIncludesGroup(race, groupName)
    {
        for (let group in race)
        {
            if (group === groupName)
            {
                return true;
            }
        }
        return false;
    }

    function getCombinations(targetRace, morphs)
    {
        for (let i = 0; i < morphs.length; i++)
        {
            if (morphs[i].EDID === targetRace)
            {
                return morphs[i].combinations.slice(); // shallow copy to allow depletion
            }
        }

        return undefined;
    }

    function generateBodyGenID(formID)
    {
        let hex = formID.substring(2,9);

        return hex.replace(/\b0+/g, ""); // gets rid of leading zeros
    }

    function updateBodyGenConsistencyRecord(assignmentRecord, chosenMorphs, chosenGroups)
    {
        if (chosenMorphs === undefined)
        {
            if (assignmentRecord !== undefined)
            {
                if (assignmentRecord.assignedMorphs !== undefined)
                {
                    delete assignmentRecord.assignedMorphs;
                }
            }
        }
        else
        {
            assignmentRecord.assignedMorphs = chosenMorphs;
        }

        if (chosenGroups === undefined)
        {
            if (assignmentRecord !== undefined)
            {
                if (assignmentRecord.assignedGroups !== undefined)
                {
                    delete assignmentRecord.assignedGroups;
                }
            }
        }
        else
        {
            assignmentRecord.assignedGroups = chosenGroups;
        }
    }

    function getMorphByName(morphs, name)
    {
        for (let group in morphs)
        {
            for (let i = 0; i < morphs[group].length; i++)
            {
                if (morphs[group][i].name === name)
                {
                    return morphs[group][i];
                }
            }
        }

        return undefined;
    }

    function bMorphGroupHasName(group, morphs, morphName)
    {
        for (let i = 0; i < morphs[group].length; i++)
        {
            if (morphs[group][i].name === morphName)
            {
                return true;
            }
        }
        return false;
    }
}