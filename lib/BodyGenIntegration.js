debugger;

module.exports = function(Aux)
{
    let BGI = {};

    BGI.assignPresets = function(NPCrecordHandle, BGconfig, categorizedPresets, NPCinfo, assignedAssetPermutation, attributeCache, logMessage)
    {
        let returnObj = {};
        let assignedPreset = [];
        let combinations;
        let combinationIndex;
        let combination;
        let item;
        let selectionList;

        let bfoundValid = false;

        let presets;
        let chosenIndex;
        let chosenPreset;
        let acceptedPresets = [];

        let filteredItems = [];

        let p = categorizedPresets[NPCinfo.gender][NPCinfo.race];
        if (p === undefined || angular.equals(p, {}))
        {
            // no match for this race and gender
            return;
        }
        else
        {
            presets = angular.copy(p); // deep copy to allow pruning
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

        while (bfoundValid === false && combinations.length > 0)
        {
            assignedPreset = [];
            combinationIndex = Math.floor(Math.random() * combinations.length);
            combination = combinations[combinationIndex];

            acceptedPresets = [];
            for (let i = 0; i < combination.length; i++)
            {
                item = combination[i];

                if (filteredItems.includes(item) === false)
                {
                    presets[item] = filterPresetsByForceIf(NPCrecordHandle, presets[item], attributeCache, xelib, logMessage);
                    filteredItems.push(item);
                }

                selectionList = presets[item];

                // choose random preset
                chosenIndex = Math.floor(Math.random() * selectionList.length);
                chosenPreset = selectionList[chosenIndex];

                if (bPresetIsValid(NPCrecordHandle, chosenPreset, assignedAssetPermutation, attributeCache, xelib, logMessage) === true)
                {
                    assignedPreset.push(chosenPreset.name);

                    if (i === combination.length - 1)
                    {
                        bfoundValid = true;
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

        if (bfoundValid === true)
        {
            returnObj.presets = assignedPreset;
            returnObj.rootPlugin = NPCinfo.masterRecordFile;
            returnObj.ID = generateBodyGenID(NPCinfo.formID);
            return returnObj;
        }

        else
        {
            logMessage("No BodyGen presets satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.formID + "). Skipping this NPC.");
            return undefined;
        }
    }

    BGI.categorizePresets = function(config, restrictionGroupDefs) 
    {
        let currentPreset;
        let presetList = [];

        let BGpresets = {};
        let groupList = [];

        let sortedList;
        let currentGroup = "";

        // set up genders
        BGpresets.female = {};
        BGpresets.male = {};
        
        // set up races and groups
        for (let i = 0 ; i < config.racialSettingsFemale.length; i++)
        {
            BGpresets.female[config.racialSettingsFemale[i].EDID] = {};
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
                BGpresets.female[config.racialSettingsFemale[i].EDID][groupList[j]] = [];
            }
        }

        for (let i = 0 ; i < config.racialSettingsMale.length; i++)
        {
            BGpresets.male[config.racialSettingsMale[i].EDID] = {};
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
                BGpresets.male[config.racialSettingsMale[i].EDID][groupList[j]] = [];
            }
        }

        // copy presets so they can be edited without altering the config file
        for (let i = 0; i < config.templates.length; i++)
        {
            presetList.push(angular.copy(config.templates[i]));
        }

        // set up presets
        for (let i = 0; i < presetList.length; i++)
        {
            currentPreset = presetList[i];

            if (currentPreset.allowedRaces.length > 0)
            {
                currentPreset.allowedRaces = Aux.replaceGroupDefWithIndividuals(currentPreset.allowedRaces, restrictionGroupDefs);
            }

            switch(currentPreset.gender)
            {
                case "female": sortedList = BGpresets.female; break;
                case "male": sortedList = BGpresets.male; break;
            }

            for (let race in sortedList)
            {
                if (currentPreset.allowedRaces.length === 0 || currentPreset.allowedRaces.includes(race))
                {
                    for (let j = 0; j < currentPreset.groups.length; j++)
                    {
                        currentGroup = currentPreset.groups[j];
                        if (bRaceIncludesGroup(sortedList[race], currentGroup))
                        {
                            sortedList[race][currentGroup].push(currentPreset);
                        }
                    }
                }
            }
        }

        return BGpresets;
    }

    return BGI;

    function filterPresetsByForceIf(NPCrecordHandle, presetList, attributeCache, xelib, logMessage)
    {
        let forcedPresetsPass1 = [];
        let forcedPresetsFinal = [];
        let maxAttributesMatched = 0;
        let currentAttributesMatched = 0;

        for (let i = 0; i < presetList.length; i++)
        {
            currentAttributesMatched = 0;
            if (presetList[i].forceIfAttributes.length > 0)
            {
                for (let j = 0; j < presetList[i].forceIfAttributes.length; j++)
                {
                    if (Aux.bAttributeMatched(presetList[i].forceIfAttributes[i][0], presetList[i].forceIfAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true)
                    {
                        currentAttributesMatched++;
                    }
                }

                if (currentAttributesMatched > 0)
                {
                    forcedPresetsPass1.push([presetList[i], currentAttributesMatched]);
                }

                if (currentAttributesMatched > maxAttributesMatched)
                {
                    maxAttributesMatched = currentAttributesMatched;
                }
            }
        }

        if (maxAttributesMatched === 0)
        {
            return presetList;
        }
        else
        {
            for (let i = 0; i < forcedPresetsPass1.length; i++)
            {
                if (forcedPresetsPass1[i][1] === maxAttributesMatched)
                {
                    forcedPresetsFinal.push(forcedPresetsPass1[i][0]);
                }
            }
            return forcedPresetsFinal;
        }
    }

    function bPresetIsValid(NPCrecordHandle, preset, chosenPermutation, attributeCache, xelib, logMessage)
    {
        let bAAsatisfied = false;

        // check allowed BodyGen presets from permutation
        if (chosenPermutation !== undefined && chosenPermutation.allowedBodyGenPresets.length > 0 && (chosenPermutation.allowedBodyGenPresets.includes(preset.name) === false))
        {
            return false;
        }

        // check disallowed BodyGen presets from permutation
        if (chosenPermutation !== undefined && chosenPermutation.disallowedBodyGenPresets.includes(preset.name) === true)
        {
            return false;
        }

        // check allowedAttributes from preset

        if (preset.allowedAttributes.length > 0)
        {
            for (let i = 0; i < preset.allowedAttributes.length; i++)
            {
                bAAsatisfied = Aux.bAttributeMatched(preset.allowedAttributes[i][0], preset.allowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache);
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

        // check disallowedAttributes from preset
        for (let i = 0; i < preset.disallowedAttributes.length; i++)
        {
            if (Aux.bAttributeMatched(preset.disallowedAttributes[i][0], preset.disallowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true)
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

    function getCombinations(targetRace, presets)
    {
        for (let i = 0; i < presets.length; i++)
        {
            if (presets[i].EDID === targetRace)
            {
                return presets[i].combinations.slice(); // shallow copy to allow depletion
            }
        }

        return undefined;
    }

    function generateBodyGenID(formID)
    {
        let hex = formID.substring(2,9);

        return hex.replace(/\b0+/g, ""); // gets rid of leading zeros
    }
}