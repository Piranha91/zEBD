debugger;
let Aux = require('./Auxilliary.js');
module.exports = function()
{
    let BGI = {};

    BGI.assignMorphs = function(NPCrecordHandle, BGconfig, categorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, assignedAssetPermutation, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCBodyGen, NPClinkGroup, bSuppressErrorMessage, attributeCache, logMessage, passConsistencyMessage)
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

        let bLinkedMorphsLoaded = false;
        let linkedData = {};

        let morphs; // can get pruned
        let morphs_origRef; // must not be pruned because it points to the original categorized morphs list which must remain constant between NPCs
        let chosenIndex;
        let chosenMorph;

        let filteredItems = [];
        let userForcedMorphs = [];
        let userForcedMorphsConsistencyTracker = [];

        let failureModes = {};
        let failureModesByCombination = {};

        if (passConsistencyMessage === undefined)
        {
            passConsistencyMessage = {};
        }

        // LINKED NPCs///
        // If NPC is linked to another NPCs, get its data and do NOT check if the morph is valid for this instance of the NPC. Some plugins do stupid things like changing NPC weight, which will spuriously cause the morph to evaluate as invalid.
        // check NPC link groups and choose linked morph if it exists
        if (NPClinkGroup !== undefined && NPClinkGroup.morphs !== undefined && NPClinkGroup.groups !== undefined && bMorphNamesComplyWithUserForcedList(NPClinkGroup.morphs, userForcedAssignment) === true)
        {
            assignedMorphs = NPClinkGroup.morphs;
            assignedGroups = NPClinkGroup.groups;
            bLinkedMorphsLoaded = true;
            bFoundValidCombination = true;
        }

        // If no link group exists, check "generic" linked NPC name list and choose linked morph if it exists there
        if (bLinkedMorphsLoaded === false && bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            linkedData = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCBodyGen);
            if (linkedData !== undefined && linkedData.assignedMorphs.length > 0 && linkedData.assignedGroups.length > 0 && bMorphNamesComplyWithUserForcedList(linkedData.assignMorphs, userForcedAssignment) === true)
            {
                assignedMorphs = linkedData.assignedMorphs;
                assignedGroups = linkedData.assignedGroups;
                bFoundValidCombination = true;
                bLinkedMorphsLoaded = true;
            }
        }
        // END LINKED NPCs

        // set up lists to select from
        morphs = angular.copy(categorizedMorphs[NPCinfo.gender][NPCinfo.race]); // deep copy to allow pruning all morphs[category] by filterMorphsByUserForceList()
        morphs_origRef = categorizedMorphs[NPCinfo.gender][NPCinfo.race]; // direct reference to the permanent storage array that should never be altered
        if (morphs === undefined || angular.equals(morphs, {}))
        {
            return; // no match for this race and gender
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
        combinations = filterCombinationsByUserForceList(userForcedAssignment, combinations, morphs, NPCinfo, bSuppressErrorMessage, logMessage);

        // filter morphs by user forced list
        userForcedMorphs = filterMorphsByUserForceList(userForcedAssignment, morphs);
        userForcedMorphsConsistencyTracker = userForcedMorphs.slice();        

        // load from consistency
        if (bEnableConsistency === true && NPCinfo.consistencyIndex > -1 && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined && bLinkedMorphsLoaded === false)
        {
            for (let i = 0; i < consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs.length; i++)
            {
                assignedGroup = consistencyRecords[NPCinfo.consistencyIndex].assignedGroups[i];
                morphs[assignedGroup] = filterMorphsByForceIf(NPCrecordHandle, NPCinfo, morphs_origRef[assignedGroup], assignedAssetPermutation, userForcedMorphs, {}, attributeCache, xelib, logMessage);
                chosenMorph = getMorphByName(morphs, consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs[i]);

                if (chosenMorph === undefined)
                {
                    bForcedValid = false;
                    if (bSuppressErrorMessage === false)
                    {
                        logMessage("\nBodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not found or was filtered out by the Specific NPC Assignments or ForceIf Attributes. Choosing a new morph.");
                    }
                    else
                    {
                        passConsistencyMessage.message = "the consistency morph was not found or was filtered out by the Specific NPC Assignments or ForceIf Attributes."
                    }
                    break;
                }

                if (bMorphIsValid(NPCrecordHandle, NPCinfo, chosenMorph, morphs_origRef[assignedGroup], assignedAssetPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage) === false) // pass the original categorizedMorphs because morphs can be pruned upstream by 
                {
                    bForcedValid = false;
                    if (bSuppressErrorMessage === false)
                    {
                        logMessage("\nBodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") is invalid according to current settings. Choosing a new morph.");
                        logMessage(Aux.formatFailureModeString_consistency(failureModes, "morph"));
                    }
                    else
                    {
                        //examine failureModes to determine what should be passed back to chooseRandomPermutation() in PatcherOps.js
                        let NPCincompatibleKeys = 0;
                        let permutationIncompatibleKeys = 0;

                        for (let [error, count] of Object.entries(failureModes))
                        {
                            if (error.indexOf("Morph's descriptor") === 0)
                            {
                                permutationIncompatibleKeys++;
                            }
                            else
                            {
                                NPCincompatibleKeys++;
                            }
                        }

                        if (NPCincompatibleKeys > 0 && permutationIncompatibleKeys === 0)
                        {
                            passConsistencyMessage.message = "the consistency morph's distribution rules were incompatible with the NPC's attributes.";
                        }
                        else if (NPCincompatibleKeys === 0 && permutationIncompatibleKeys > 0)
                        {
                            passConsistencyMessage.message = "the consistency morph's descriptors were incompatible with the permutation's constraints.";
                        }
                        else if (NPCincompatibleKeys > 0 && permutationIncompatibleKeys > 0)
                        {
                            passConsistencyMessage.message = "the consistency morph's distribution rules were incompatible with the NPC's attributes and the consistency morph's descriptors were incompatible with the permutation's constraints.";
                        }
                    }
                    break;
                }

                if (userForcedMorphsConsistencyTracker.includes(chosenMorph.name))
                {
                    userForcedMorphsConsistencyTracker.splice(userForcedMorphsConsistencyTracker.indexOf(chosenMorph.name));
                }
            }
            
            // check to make sure all user forced morphs have been assigned
            if (userForcedMorphs.length > 0 && userForcedMorphsConsistencyTracker.length > 0 && bForcedValid === true) // check if bForcedValid === true to avoid overwriting the passConsistencyMessage above if there's already a message about the morph being invalid due to other reasons
            {
                bForcedValid = false;
                if (bSuppressErrorMessage === false)
                {
                    logMessage("\nBodyGen Assignment: consistency morph for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") does not comply with your Specific NPC Assignments.");
                }
                else
                {
                    passConsistencyMessage.message = "the consistency morph does not comply with your Specific NPC Assignments."
                }
            }

            if (bForcedValid === true)
            {
                assignedMorphs = consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs;
                assignedGroups = consistencyRecords[NPCinfo.consistencyIndex].assignedGroups;
                bFoundValidCombination = true;
            }
        }

        // random morph assignment

        while (bFoundValidCombination === false && combinations.length > 0) // note: The tracked parameter here is combinations
        {
            assignedMorphs = []; // reset the assigned morph list if picking a new combination
            assignedGroups = []; // reset the assigned group list if picking a new combination

            // randomly choose a valid combination for this NPC (e.g. top+bottom)
            combinationIndex = chooseRandomFromProbabilityWeighting(combinations);
            combination = combinations[combinationIndex].members;

            for (let i = 0; i < combination.length; i++)  // choose a morph for each item in the combination
            {
                item = combination[i]; // STRING e.g. "top" or "bottom"
                failureModesByCombination[item] = {};
                selectionList = morphs[item].slice(); // shallow copy to allow pruning

                if (filteredItems.includes(item) === false) // filteredItems simply logs that the given group within the morph list has already been filtered by ForceIF and doesn't need to be filtered again
                {
                    selectionList = filterMorphsByForceIf(NPCrecordHandle, NPCinfo, selectionList, assignedAssetPermutation, userForcedMorphs, failureModesByCombination[item], attributeCache, xelib, logMessage);
                    filteredItems.push(item);
                }

                // choose random morph that belongs to the current group
                bFoundValidMorph = false;
                while (bFoundValidMorph === false && selectionList.length > 0) // note: The tracked parameter here is selectionList
                {
                    chosenIndex = chooseRandomFromProbabilityWeighting(selectionList);
                    chosenMorph = selectionList[chosenIndex];

                    bFoundValidMorph = bMorphIsValid(NPCrecordHandle, NPCinfo, chosenMorph, morphs[item], assignedAssetPermutation, userForcedMorphs, failureModesByCombination[item], attributeCache, xelib, logMessage);

                    if (bFoundValidMorph === true)
                    {
                        assignedMorphs.push(chosenMorph.name);
                        assignedGroups.push(item);
                        delete failureModesByCombination[item]; // if the given group within the combination was assigned succesfully, clear its failureModes so that they aren't erroneously reported

                        if (i === combination.length - 1) // if the current item is the last one in the combination, and the morph for this item is valid, then the whole combination is valid.
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
                    for (let j = 0; j < combinations.length; j++)
                    {
                        if (combinations[j].members.includes(item) === true)
                        {
                            combinations.splice(j, 1);
                            j--;
                        }
                    }
                    break; // out of the for loop iterating over current combination (indexed by i), and pick a different combination (or break from the outer while loop if combinations.length is now 0)
                }
            }
        }

        // return
        if (bFoundValidCombination === true)
        {            
            // reminder: consistency and linked NPC data are handled externally in index.js as of v1.8. Do not assign here
            returnObj.morphs = assignedMorphs;
            returnObj.groups = assignedGroups;
            returnObj.rootPlugin = NPCinfo.rootPlugin;
            returnObj.ID = generateBodyGenID(NPCinfo.formID);
            return returnObj;
        }

        else
        {
            if (bSuppressErrorMessage === false)
            {
                logMessage("\nBodyGen Assignment: no BodyGen morphs satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). Skipping this NPC.");
                for (let [combName, combFailureModes] of Object.entries(failureModesByCombination))
                {
                    logMessage(Aux.formatFailureModeString(combFailureModes, "morph", "combination " + combName));
                }
            }
            return undefined;
        }
    }

    BGI.updateLinkedBodyGenData = function(assignedBG, bLinkNPCsWithSameName, NPCinfo, LinkedNPCNameExclusions, linkedNPCBodyGen, NPClinkGroup)
    {
        linkedData = {};
        linkedData.assignedMorphs = assignedBG.morphs;
        linkedData.assignedGroups = assignedBG.groups;

        // update "generic" linked NPC list
        Aux.updatelinkedDataArray(bLinkNPCsWithSameName, NPCinfo, linkedData, LinkedNPCNameExclusions, linkedNPCBodyGen);

        // update NPC linked groups
        if (NPClinkGroup !== undefined && NPClinkGroup.morphs === undefined && NPClinkGroup.groups === undefined)
        {
            NPClinkGroup.morphs = assignedBG.morphs;
            NPClinkGroup.groups = assignedBG.groups;
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

    BGI.convertMorphWeightRangeToNum = function(templateList)
    {
        for (let i = 0; i < templateList.length; i++)
        {
            templateList[i].weightRange[0] = parseFloat(templateList[i].weightRange[0]);
            templateList[i].weightRange[1] = parseFloat(templateList[i].weightRange[1]);
        }
    }

    BGI.updateBodyGenConsistencyRecord = function(bgObject, NPCrecordHandle, NPCinfo, consistencyRecords, xelib)
    {
        if (bgObject !== undefined && NPCinfo.consistencyIndex === -1) // if no record of this NPC exists in the consistency file, create one
        {
            Aux.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib) // NPCinfo.consistencyIndex gets updated here
        } 

        let assignmentRecord = consistencyRecords[NPCinfo.consistencyIndex];

        if (bgObject === undefined)
        {
            if (assignmentRecord !== undefined)
            {
                if (assignmentRecord.assignedMorphs !== undefined)
                {
                    delete assignmentRecord.assignedMorphs;
                }
                if (assignmentRecord.assignedGroups !== undefined)
                {
                    delete assignmentRecord.assignedGroups;
                }
            }
        }
        else
        {
            assignmentRecord.assignedMorphs = bgObject.morphs;
            assignmentRecord.assignedGroups = bgObject.groups;
        }
    }

    return BGI;
}

function bMorphIsValid(NPCrecordHandle, NPCinfo, morph, morphList, chosenPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage)
{
    let bAAsatisfied = false;

    // check allowed BodyGen descriptors from permutation
    if (chosenPermutation !== undefined && chosenPermutation.allowedBodyGenDescriptors !== undefined) // note: don't respect userForcedMorphs here because if this returns false, PO.chooseRandomPermutation will try to find a different chosenPermutation to satisfy this function
    {
        for (let category in chosenPermutation.allowedBodyGenDescriptors)
        {
            if (bMorphListIncludesDescriptorCategory(morphList, category) === true && bMorphDescriptorsIncludesCurrent(morph, category, chosenPermutation.allowedBodyGenDescriptors[category]) === false)
            {
                Aux.updateFailureModes(failureModes, "Morph's descriptors for \"" + category + "\" don't match those allowed by the chosen permutation (" + chosenPermutation.allowedBodyGenDescriptors[category].join() + ")");
                return false;
            }
        }
    }

    // check disallowed BodyGen descriptors from permutation
    if (chosenPermutation !== undefined && chosenPermutation.disallowedBodyGenDescriptors !== undefined) // note: don't respect userForcedMorphs here because if this returns false, PO.chooseRandomPermutation will try to find a different chosenPermutation to satisfy this function
    {
        for (let i = 0; i < chosenPermutation.disallowedBodyGenDescriptors.length; i++)
        {
            for (let j = 0; j < morph.descriptors.length; j++)
            {
                if (chosenPermutation.disallowedBodyGenDescriptors[i].category === morph.descriptors[j].category && chosenPermutation.disallowedBodyGenDescriptors[i].value === morph.descriptors[j].value)
                {
                    Aux.updateFailureModes(failureModes, "Morph's descriptor " + chosenPermutation.disallowedBodyGenDescriptors[i].value + " is disallowed by the chosen permutation");
                    return false;
                }
            }
        }
    }

    // perform the following checks only if the current morph isn't specified by the user's Specific NPC Assignments

    if (userForcedMorphs.includes(morph.name) === false)
    {
        if (morph.allowRandom === false)
        {
            Aux.updateFailureModes(failureModes, "Distribution disallowed to non-user-specified NPCs");
            return false;
        }

        // check allowedAttributes from morph

        if (morph.allowedAttributes.length > 0)
        {
            let tmpFailModes = "";
            for (let i = 0; i < morph.allowedAttributes.length; i++)
            {
                bAAsatisfied = Aux.bAttributeMatched(morph.allowedAttributes[i][0], morph.allowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache);
                if (bAAsatisfied === true)
                {
                    break;
                }
                else
                {
                    tmpFailModes += "\n(" + morph.allowedAttributes[i][0] + ": " + morph.allowedAttributes[i][1] + ")";
                }
            }

            if (bAAsatisfied === false)
            {
                Aux.updateFailureModes(failureModes, "NPC lacks all of the following allowed attributes:" + tmpFailModes);
                return false;
            }
        }

        // check disallowedAttributes from morph if the morph is not specified by user
        for (let i = 0; i < morph.disallowedAttributes.length; i++)
        {
            if (Aux.bAttributeMatched(morph.disallowedAttributes[i][0], morph.disallowedAttributes[i][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true)
            {
                Aux.updateFailureModes(failureModes, "NPC has disallowed attribute: (" + morph.disallowedAttributes[i][0] + ": " + morph.disallowedAttributes[i][1] + ")");
                return false;
            }
        }

        if (NPCinfo.isUnique === true && morph.allowUnique === false)
        {
            Aux.updateFailureModes(failureModes, "Distribution disallowed for unique NPCs");
            return false;
        }
        else if (NPCinfo.isUnique === false && morph.allowNonUnique === false)
        {
            Aux.updateFailureModes(failureModes, "Distribution disallowed for non-unique NPCs");
            return false;
        }

        if (Aux.isValidNumber(morph.weightRange[0]) && NPCinfo.weight < morph.weightRange[0])
        {
            Aux.updateFailureModes(failureModes, "NPC weight (" + NPCinfo.weight.toString() + ") <  " + morph.weightRange[0].toString());
            return false;
        }
        if (Aux.isValidNumber(morph.weightRange[1]) && NPCinfo.weight > morph.weightRange[1])
        {
            Aux.updateFailureModes(failureModes, "NPC weight (" + NPCinfo.weight.toString() + ") >  " + morph.weightRange[1].toString());
            return false;
        }
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

function filterMorphsByForceIf(NPCrecordHandle, NPCinfo, morphList, assignedAssetPermutation, userForcedMorphs, failureModes, attributeCache, xelib, logMessage)
{
    let forcedMorphsPass1 = [];
    let forcedMorphsFinal = [];
    let maxAttributesMatched = 0;
    let currentAttributesMatched = 0;
    let matchedForceIfs = [];

    for (let i = 0; i < morphList.length; i++)
    {
        currentAttributesMatched = 0;
        if (morphList[i].forceIfAttributes.length > 0)
        {
            for (let j = 0; j < morphList[i].forceIfAttributes.length; j++)
            {
                if (Aux.bAttributeMatched(morphList[i].forceIfAttributes[j][0], morphList[i].forceIfAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache) === true && bMorphIsValid(NPCrecordHandle, NPCinfo, morphList[i], morphList, assignedAssetPermutation, userForcedMorphs, [], attributeCache, xelib, logMessage) === true)
                {
                    currentAttributesMatched++;
                    matchedForceIfs.push(morphList[i].forceIfAttributes[j]);
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

        //Store FailureModes to inform user in case none of the filtered morphs end up being valid
        let dispString = "";
        for (let i = 0; i < matchedForceIfs.length; i++)
        {
            dispString += "(" + matchedForceIfs[i][0] + ": " + matchedForceIfs[i][1] + ")";
            if (i < matchedForceIfs.length - 1)
            {
                dispString += ", ";
            }
        }
        failureModes["Morph removed due to competing ForceIf attributes: " + dispString] =  morphList.length - forcedMorphsFinal.length;

        return forcedMorphsFinal;
    }
}

function filterCombinationsByUserForceList(userForcedAssignment, combinations, morphs, NPCinfo, bSuppressErrorMessage, logMessage)
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
        else if (bSuppressErrorMessage === false)
        {
            logMessage("\nBodyGen Assignment: could not find a BodyGen Template Group Combination that contained all forced morphs for " + NPCinfo.name + " (" + NPCinfo.formID + "). Choosing morphs at random.")
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

function bMorphNamesComplyWithUserForcedList(morphNames, userForcedAssignment) // returns false if any more in userForcedMorphs doesn't appear in morphNames
{
    if (userForcedAssignment === undefined || userForcedAssignment.forcedBodyGenMorphs === undefined)
    {
        return true;
    }

    for (let i = 0; i < userForcedAssignment.forcedBodyGenMorphs.length; i++)
    {
        if (morphNames.includes[userForcedAssignment.forcedBodyGenMorphs[i]] === false)
        {
            return false;
        }
    }
}
