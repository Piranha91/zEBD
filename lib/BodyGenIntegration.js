debugger;

module.exports = function(Aux, PO)
{
    let BGI = {};

    BGI.assignMorphs = function(NPCrecordHandle, BGconfig, categorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, assignedAssetPermutation, userForcedAssignment, attributeCache, logMessage)
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

        let morphs;
        let morphListForGroup;
        let chosenIndex;
        let chosenMorph;

        let filteredItems = [];
        let userForcedMorphs = [];

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

        // filter morphs by user forced list
        userForcedMorphs = filterMorphsByUserForceList(userForcedAssignment, morphs);

        // load from consistency
        if (bEnableConsistency === true && NPCinfo.consistencyIndex > -1 && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined)
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

                if (bMorphIsValid(NPCrecordHandle, chosenMorph, morphListForGroup, assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage) === false)
                {
                    bForcedValid = false;
                    logMessage("BodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.formID + ") is invalid according to current settings. Choosing at random.");
                    break;
                }
            }

            if (bForcedValid === true)
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
                    morphs[item] = filterMorphsByForceIf(NPCrecordHandle, morphs[item], assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage);
                    filteredItems.push(item);
                }

                selectionList = morphs[item];

                // choose random morph that belongs to the current group
                bFoundValidMorph = false;
                while (bFoundValidMorph === false && selectionList.length > 0) // note: The tracked parameter here is selectionList
                {
                    chosenIndex = chooseRandomFromProbabilityWeighting(selectionList);
                    chosenMorph = selectionList[chosenIndex];

                    bFoundValidMorph = bMorphIsValid(NPCrecordHandle, chosenMorph, morphs[item], assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage);

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
            }

            if (selectionList.length === 0) // if there are no valid morphs for the current group within the current combination:
            {
                //  purge any combination that contains this group
                for (let i = 0; i < combinations.length; i++)
                {
                    if (combinations[i].members.includes(item) === true)
                    {
                        combinations.splice(i, 1);
                        i--;
                    }
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
                    PO.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib) // NPCinfo.consistencyIndex gets updated here
                } 
                updateBodyGenConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], assignedMorphs, assignedGroups);
            }   

            returnObj.morphs = assignedMorphs;
            returnObj.rootPlugin = NPCinfo.masterRecordFile;
            returnObj.ID = generateBodyGenID(NPCinfo.formID);
            return returnObj;
        }

        else
        {
            logMessage("No BodyGen morphs satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.formID + "). Skipping this NPC.");

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

            switch(currentMorph.gender)
            {
                case "female": sortedList = BGmorphs.female; break;
                case "male": sortedList = BGmorphs.male; break;
            }

            for (let race in sortedList)
            {
                if (currentMorph.allowedRaces.length === 0 || currentMorph.allowedRaces.includes(race))
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

    return BGI;

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

    function filterMorphsByForceIf(NPCrecordHandle, morphList, assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage)
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
                    if (Aux.bAttributeMatched(morphList[i].forceIfAttributes[i][0], morphList[i].forceIfAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true && bMorphIsValid(NPCrecordHandle, morphList[i], morphList, assignedAssetPermutation, userForcedMorphs, attributeCache, xelib, logMessage) === true)
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

    function bMorphIsValid(NPCrecordHandle, morph, morphList, chosenPermutation, userForcedMorphs, attributeCache, xelib, logMessage)
    {
        let bAAsatisfied = false;
        let bDescriptorFound = false;
        let bDescriptorMatched = false;

        if (userForcedMorphs.includes(morph.name))
        {
            return true;
        }

        // check allowed BodyGen descriptors from permutation
        if (chosenPermutation !== undefined && chosenPermutation.allowedBodyGenDescriptors !== undefined)
        {
            bDescriptorFound = false;
            for (let i = 0; i < chosenPermutation.allowedBodyGenDescriptors.length; i++)
            {
                // check if any member of the morph list contains the allowed descriptor
                for (let j = 0; j < morphList.length; j++)
                {
                    if (morphList[j].descriptors.includes(chosenPermutation.allowedBodyGenDescriptors[i]))
                    {
                        bDescriptorFound = true; break;
                    }
                }

                // if so, discard this morph if it's not one of the ones that contains the descriptor
                if (bDescriptorFound === true && morph.descriptors.includes(chosenPermutation.allowedBodyGenDescriptors[i]) === true)
                {
                    bDescriptorMatched = true;
                    break;
                }
            }

            if (bDescriptorFound === true && bDescriptorMatched === false)
            {
                return false;
            }
        }

        // check disallowed BodyGen descriptors from permutation
        if (chosenPermutation !== undefined && chosenPermutation.disallowedBodyGenDescriptors !== undefined)
        {
            for (let i = 0; i < chosenPermutation.disallowedBodyGenDescriptors.length; i++)
            {
                if (morph.descriptors.includes(chosenPermutation.disallowedBodyGenDescriptors[i]))
                {
                    return false;
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
                return false;
            }
        }

        // check disallowedAttributes from morph
        for (let i = 0; i < morph.disallowedAttributes.length; i++)
        {
            if (Aux.bAttributeMatched(morph.disallowedAttributes[i][0], morph.disallowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true)
            {
                return false;
            }
        }

        return true;
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