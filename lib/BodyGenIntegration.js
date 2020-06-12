debugger;

module.exports = function(Aux, PO)
{
    let BGI = {};

    BGI.assignMorphs = function(NPCrecordHandle, BGconfig, categorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, assignedAssetPermutation, attributeCache, logMessage)
    {
        let returnObj = {};
        let assignedMorphs = [];
        let assignedGroups = [];
        let combinations;
        let combinationIndex;
        let combination;
        let item;
        let selectionList;

        let bFoundValid = false;
        let bForcedValid = true;

        let morphs;
        let morphListForGroup;
        let chosenIndex;
        let chosenMorph;

        let filteredItems = [];

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
                    break;
                }

                if (bMorphIsValid(NPCrecordHandle, chosenMorph, morphListForGroup, assignedAssetPermutation, attributeCache, xelib, logMessage) === false)
                {
                    bForcedValid = false;
                    break;
                }
            }

            if (bForcedValid === true)
            {
                assignedMorphs = consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs;
                bFoundValid = true;
            }
        }

        // random generation
        while (bFoundValid === false && combinations.length > 0)
        {
            assignedMorphs = [];
            assignedGroups = [];
            combinationIndex = Math.floor(Math.random() * combinations.length);
            combination = combinations[combinationIndex];

            for (let i = 0; i < combination.length; i++)
            {
                item = combination[i];

                if (filteredItems.includes(item) === false)
                {
                    morphs[item] = filterMorphsByForceIf(NPCrecordHandle, morphs[item], assignedAssetPermutation, attributeCache, xelib, logMessage);
                    filteredItems.push(item);
                }

                selectionList = morphs[item];

                // choose random morph
                chosenIndex = Math.floor(Math.random() * selectionList.length);
                chosenMorph = selectionList[chosenIndex];

                if (bMorphIsValid(NPCrecordHandle, chosenMorph, morphs[item], assignedAssetPermutation, attributeCache, xelib, logMessage) === true)
                {
                    assignedMorphs.push(chosenMorph.name);
                    assignedGroups.push(item);

                    if (i === combination.length - 1)
                    {
                        bFoundValid = true;
                    }
                }
                else
                {
                    selectionList.splice(chosenIndex, 1);
                }

                if (selectionList.length === 0)
                {
                    break;
                }
            }

            if (selectionList.length === 0)
            {
                // if there are no more entries for this item in the selection list, purge any combination that requires this item
                for (let i = 0; i < combinations.length; i++)
                {
                    if (combinations[i].includes(item) === true)
                    {
                        combinations.splice(i, 1);
                        i--;
                    }
                }
            }
        }


        // consistency and return
        if (bFoundValid === true)
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
                for (let k = 0; k < config.racialSettingsFemale[i].combinations[j].length; k++)
                {
                    if (groupList.includes(config.racialSettingsFemale[i].combinations[j][k]) === false)
                    {
                        groupList.push(config.racialSettingsFemale[i].combinations[j][k]);
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
                for (let k = 0; k < config.racialSettingsMale[i].combinations[j].length; k++)
                {
                    if (groupList.includes(config.racialSettingsMale[i].combinations[j][k]) === false)
                    {
                        groupList.push(config.racialSettingsMale[i].combinations[j][k]);
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

    function filterMorphsByForceIf(NPCrecordHandle, morphList, assignedAssetPermutation, attributeCache, xelib, logMessage)
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
                    if (Aux.bAttributeMatched(morphList[i].forceIfAttributes[i][0], morphList[i].forceIfAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true && bMorphIsValid(NPCrecordHandle, morphList[i], morphList, assignedAssetPermutation, attributeCache, xelib, logMessage) === true)
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

    function bMorphIsValid(NPCrecordHandle, morph, morphList, chosenPermutation, attributeCache, xelib, logMessage)
    {
        let bAAsatisfied = false;
        let bDescriptorFound = false;

        // check allowed BodyGen descriptors from permutation
        if (chosenPermutation !== undefined && chosenPermutation.allowedBodyGenDescriptors !== undefined)
        {
            for (let i = 0; i < chosenPermutation.allowedBodyGenDescriptors.length; i++)
            {
                bDescriptorFound = false;
                
                // check if any member of the morph list contains the allowed descriptor
                for (let j = 0; j < morphList.length; j++)
                {
                    if (morphList[j].descriptors.includes(chosenPermutation.allowedBodyGenDescriptors[i]))
                    {
                        bDescriptorFound = true; break;
                    }
                }

                // if so, discard this morph if it's not one of the ones that contains the descriptor
                if (bDescriptorFound === true && morph.descriptors.includes(chosenPermutation.allowedBodyGenDescriptors[i]) === false)
                {
                    return false;
                }
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
}