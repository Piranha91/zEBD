debugger;
module.exports =
    {
        initializeSubgroup(template)
        {
            let newSubgroup = {};
            newSubgroup.id = "";
            newSubgroup.distributionEnabled = true;
            newSubgroup.probabilityWeighting= 1;
            newSubgroup.allowUnique =  true;
            newSubgroup.allowNonUnique = true;
            newSubgroup.allowedRaces = [];
            newSubgroup.disallowedRaces = [];
            newSubgroup.allowedAttributes = [];
            newSubgroup.disallowedAttributes = [];
            newSubgroup.forceIfAttributes = [],
            newSubgroup.weightRange = [NaN, NaN],
            newSubgroup.requiredSubgroups = {}; /// NOTE THIS IS OBJECT NOT ARRAY
            newSubgroup.excludedSubgroups = [];
            newSubgroup.containedSubgroupIDs = []; // used to capture the path traversed to the final subgroup nodes, because otherwise the non-terminal node IDs are lost. These are needed for the final required/excludedSubgroups check
            newSubgroup.containedSubgroupNames = []; // same as above, but for names
            newSubgroup.addKeywords = [],
            newSubgroup.paths = [];
            newSubgroup.emptyFlagAR = true; // defaults to true, make sure to set to false if allowedRaces gets populated
            newSubgroup.allowedBodyGenDescriptors = {}; /// NOTE THIS IS OBJECT NOT ARRAY
            newSubgroup.disallowedBodyGenDescriptors = [];
            
            if (template !== undefined)
            {
                newSubgroup.id = template.id;
                newSubgroup.distributionEnabled = template.distributionEnabled;
                newSubgroup.probabilityWeighting = template.probabilityWeighting;
                newSubgroup.allowUnique = template.allowUnique;
                newSubgroup.allowNonUnique = template.allowNonUnique;
                newSubgroup.parentAssetPack = template.parentAssetPack;
                newSubgroup.topLevelIndex = template.topLevelIndex;
            }

            return newSubgroup;
        },

        copySubgroupComponents(copyFrom, copyTo)
        {
            copyTo.paths.push(...copyFrom.paths);
            copyTo.allowedRaces.push(...copyFrom.allowedRaces);
            copyTo.disallowedRaces.push(...copyFrom.disallowedRaces);
            copyTo.allowedAttributes.push(...copyFrom.allowedAttributes);
            copyTo.disallowedAttributes.push(...copyFrom.disallowedAttributes);
            copyTo.forceIfAttributes.push(...copyFrom.forceIfAttributes);
            this.copyObjectArrayInto(copyFrom.requiredSubgroups, copyTo.requiredSubgroups, false);
            copyTo.excludedSubgroups.push(...copyFrom.excludedSubgroups);
            copyTo.containedSubgroupIDs.push(...copyFrom.containedSubgroupIDs);
            copyTo.containedSubgroupNames.push(...copyFrom.containedSubgroupNames);
            copyTo.addKeywords.push(...copyFrom.addKeywords);
            this.copyObjectArrayInto(copyFrom.allowedBodyGenDescriptors, copyTo.allowedBodyGenDescriptors, false);
            copyTo.disallowedBodyGenDescriptors.push(...copyFrom.disallowedBodyGenDescriptors);

            copyTo.allowedRaces = this.getArrayUniques(copyTo.allowedRaces);
            copyTo.disallowedRaces = this.getArrayUniques(copyTo.disallowedRaces);
            copyTo.excludedSubgroups = this.getArrayUniques(copyTo.excludedSubgroups);
            copyTo.disallowedBodyGenDescriptors = this.getArrayUniques(copyTo.disallowedBodyGenDescriptors);
        },

        copyFlattenedSubgroupArray(orig) // copies the top-level and sub-arrays, but does not deep copy the subgroups themselves
        {
            let newArr = [];
            for (let i = 0; i < orig.length; i++)
            {
                newArr.push([]);
                for (let j = 0; j < orig[i].length; j++)
                {
                    newArr[i].push(orig[i][j]);
                }
            }
            return newArr;
        },

        isSubgroupBallowedBySubgroupA_sRequiredSubgroups(subgroupA, subgroupB, subgroupBindex)
        {
            let bValid = true;

            if (subgroupA.requiredSubgroups !== undefined && subgroupA.requiredSubgroups[subgroupBindex] !== undefined)
            {
                bValid = false;
                for (let i = 0; i < subgroupA.requiredSubgroups[subgroupBindex].length; i++)
                {
                    if (subgroupB.containedSubgroupIDs.includes(subgroupA.requiredSubgroups[subgroupBindex][i]) === true)
                    {
                        bValid = true;
                        break;
                    }
                }
            }

            return bValid;
        },

        formatAssetPacksForVerbose(assetPacks, bAddMultiplicity)
        {
            let reportString = "";
            for (let i = 0; i < assetPacks.length; i++)
            {
                reportString += assetPacks[i].groupName + ":\n";
                reportString += this.formatFlattenedSubgroupsForVerbose(assetPacks[i].flattenedSubgroups, bAddMultiplicity);
            }
            return reportString;
        },

        formatFlattenedSubgroupsForVerbose(flattenedSubgroups, bAddMultiplicity)
        {
            let reportString = "";
            for (let i = 0; i < flattenedSubgroups.length; i++)
            {
                if (flattenedSubgroups[i].length === 0)
                {
                    reportString += i + ": NONE\n";
                }
                else
                {
                    reportString += i + " (" + flattenedSubgroups[i][0].containedSubgroupIDs[0] + "): [";
                    for (let j = 0; j < flattenedSubgroups[i].length; j++)
                    {
                        reportString+= flattenedSubgroups[i][j].id;
                        if (bAddMultiplicity === true)
                        {
                            reportString += " (x" + flattenedSubgroups[i][j].probabilityWeighting + ")";
                        }
                        if (j < flattenedSubgroups[i].length - 1)
                        {
                            reportString += ", ";
                        }
                    }
                    reportString += "]\n";
                }
            }
            reportString += "\n";
            return reportString;
        },

        formatForceIfAttributeArrayForVerbose(arr)
        {
            let str = " (";
            for (let i = 0; i < arr.length; i++)
            {
                str += "[" + arr[i][0] + ": " + arr[i][1] + "]"
                if (i < arr.length - 1)
                {
                    str += ", ";
                }
            }

            str += ")";
            return str;
        },

        generateDateString()
        {
            let currentDate = new Date(); // initialized with current timestamp
            let dateString = currentDate.toUTCString();
            return dateString.replace(new RegExp(':', 'g'), '-');
        },

        convertAttributePairsToObjects(attributePairs, sourceSubgroup)
        {
            let Aobj;
            let objectList = [];
            for (let i = 0; i < attributePairs.length; i++)
            {
                Aobj = {};
                Aobj.attribute = attributePairs[i];
                Aobj.indexInCurrentArray = -1; // to be filled later if necessary (used for forceIfAttributes)
                Aobj.sourceSubgroupID = sourceSubgroup.id;
                Aobj.sourceSubgroupTop = sourceSubgroup.containedSubgroupIDs[0]; // first one should always be the highest level subgroup
                objectList.push(Aobj);
            }

            return objectList;
        },

        stripSubgroupInstancesFromList(subgroup, list)
        {
            for (let i = 0; i < list.length; i++)
            {
                if (list[i].id === subgroup.id && list[i].parentAssetPack === subgroup.parentAssetPack)
                {
                    list.splice(i, 1);
                    i--;
                }
            }
        },

        stripSubgroupInstancesFromListByTopLevelIndex(index, list)
        {
            for (let i = 0; i < list.length; i++)
            {
                if (list[i].topLevelIndex === index)
                {
                    list.splice(i, 1);
                    i--;
                }
            }
        },

        generateSubgroupArrayByMultiplicity(subgroupList, weightReporter)
        {
            let subgroupsByMulti = [];
            for (let i = 0; i < subgroupList.length; i++)
            {
                if (subgroupList[i].probabilityWeighting > 1)
                {
                    weightReporter.weighted = true;
                }
                
                for (let j = 0; j < subgroupList[i].probabilityWeighting; j++)
                {
                    subgroupsByMulti.push(subgroupList[i]);
                }
            }

            return subgroupsByMulti;
        },

        linkRequiredSubgroups(subgroup, assetPack)
        {
            for (let i = 0; i < subgroup.requiredSubgroups.length; i++)
            {
                for (let j = 0; j < assetPack.flattenedSubgroups.length; j++)
                {
                    for (let k = 0; k < assetPack.flattenedSubgroups[j].length; k++)
                    {
                        if (subgroup.requiredSubgroups[i] === assetPack.flattenedSubgroups[j][k].id)
                        {
                            subgroup.requiredSubgroups[i] = assetPack.flattenedSubgroups[j][k];
                        }
                    }
                }
            }
        },

        createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib)
        {
            assignmentRecord = {};
            assignmentRecord.rootPlugin = xelib.GetFileName(xelib.GetElementFile(xelib.GetMasterRecord(NPCrecordHandle)));
            assignmentRecord.formIDSignature = NPCinfo.formID.substring(2, 9);
            assignmentRecord.EDID = xelib.EditorID(NPCrecordHandle);
            assignmentRecord.name = xelib.FullName(NPCrecordHandle);
            NPCinfo.consistencyIndex = consistencyRecords.length;
            consistencyRecords.push(assignmentRecord);
        },

        updatelinkedDataArray(bLinkNPCsWithSameName, NPCinfo, linkedData, exclusionList, linkedDataArray)
        {
            let bExcluded = false;
            if (bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
            {
                for (let i = 0; i < exclusionList.length; i++)
                {
                    if (NPCinfo.name.toLowerCase().includes(exclusionList[i].toLowerCase()) === true)
                    {
                        bExcluded = true;
                        break;
                    }
                }

                if (bExcluded === false)
                {
                    linkedDataArray.push([NPCinfo.name, NPCinfo.race, NPCinfo.gender, linkedData]);
                }
            }
        },

        findInfoInlinkedNPCdata(NPCinfo, linkedData)
        {
            if (NPCinfo.name === "" || NPCinfo.name === "Prisoner" || NPCinfo.EDID.includes("Preset")) // avoid linking presets
            {
                return undefined;
            }

            for (let i = 0; i < linkedData.length; i++)
            {
                if (linkedData[i][0] === NPCinfo.name && linkedData[i][1] === NPCinfo.race && linkedData[i][2] === NPCinfo.gender)
                {
                    return linkedData[i][3];
                }
            }
            return undefined;
        },

        sortRaceAliases(raceAliases)
        {
            let aliasObj = {};
            aliasObj.male = {};
            aliasObj.female = {};

            for (let i = 0; i < raceAliases.length; i++)
            {
                if (raceAliases[i].bMale === true)
                {
                    if (aliasObj.male[raceAliases[i].race] === undefined)
                    {
                        aliasObj.male[raceAliases[i].race] = {};
                    }

                    if (raceAliases[i].bApplyToAssets === true)
                    {
                        aliasObj.male[raceAliases[i].race].assets = raceAliases[i].aliasRace;
                    }

                    if (raceAliases[i].bApplyToHeight === true)
                    {
                        aliasObj.male[raceAliases[i].race].height = raceAliases[i].aliasRace;
                    }

                    if (raceAliases[i].bApplyToBodyGen === true)
                    {
                        aliasObj.male[raceAliases[i].race].bodyGen = raceAliases[i].aliasRace;
                    }
                }

                if (raceAliases[i].bFemale === true)
                {
                    if (aliasObj.female[raceAliases[i].race] === undefined)
                    {
                        aliasObj.female[raceAliases[i].race] = {};
                    }

                    if (raceAliases[i].bApplyToAssets === true)
                    {
                        aliasObj.female[raceAliases[i].race].assets = raceAliases[i].aliasRace;
                    }

                    if (raceAliases[i].bApplyToHeight === true)
                    {
                        aliasObj.female[raceAliases[i].race].height = raceAliases[i].aliasRace;
                    }

                    if (raceAliases[i].bApplyToBodyGen === true)
                    {
                        aliasObj.female[raceAliases[i].race].bodyGen = raceAliases[i].aliasRace;
                    }
                }
            }
            return aliasObj;
        },

        setAliasRace(NPCinfo, sortedAliases, type)
        {
            if(sortedAliases[NPCinfo.gender][NPCinfo.origRace] !== undefined && sortedAliases[NPCinfo.gender][NPCinfo.origRace][type] !== undefined)
            {
                NPCinfo.race = sortedAliases[NPCinfo.gender][NPCinfo.origRace][type];
            }
        },

        revertAliasRace(NPCinfo)
        {
            NPCinfo.race = NPCinfo.origRace;
        },

        isValidNumber(value)
        {
            return !(value === undefined || value === null || Number.isNaN(value) === true);
        },

        getTopLevelSubgroup(subgroups, IDtoSearch)
        {
            for (let k = 0; k < subgroups.length; k++)
            {
                bFound = this.bSubgroupHasChildSubgroup(subgroups[k], IDtoSearch);
                if (bFound === true)
                {
                    topLevelSubgroup = subgroups[k].id;
                    break;
                }
            }

            return topLevelSubgroup;
        },

        bSubgroupHasChildSubgroup: function(subgroup, IDtoSearch)
        {
            let bFound = false;
            if (subgroup.id === IDtoSearch)
            {
                return true;
            }
            else
            {
                for (let i = 0; i < subgroup.subgroups.length; i++)
                {
                    bFound = this.bSubgroupHasChildSubgroup(subgroup.subgroups[i], IDtoSearch);
                    if (bFound === true)
                    {
                        break;
                    }
                }
            }
            return bFound;
        },

        getSubgroupByName: function(subgroup, IDtoSearch)
        {
            let toReturn;
            if (subgroup.id === IDtoSearch)
            {
                toReturn = subgroup;
            }
            else
            {
                for (let i = 0; i < subgroup.subgroups.length; i++)
                {
                    toReturn = this.getSubgroupByName(subgroup.subgroups[i], IDtoSearch);
                    if (toReturn !== undefined)
                    {
                        break;
                    }
                }
            }
            return toReturn;
        },

        getSubgroupByIDfromArray: function(id, array)
        {
            for (let i = 0; i < array.length; i++)
            {
                if (array[i].id === id)
                {
                    return array[i];
                }
            }
        },

        getSubgroupIndexBySubgroupFromArray(subgroup, array, mode)
        {
            switch(mode)
            {
                case "byID":
                    for (let i = 0; i < array.length; i++)
                    {
                        if (subgroup.id === array[i].id)
                        {
                            return i;
                        }
                    }
                    break;

                case "byReference":
                    for (let i = 0; i < array.length; i++)
                    {
                        if (subgroup === array[i])
                        {
                            return i;
                        }
                    }
            }                
        },

        createBodyGenTemplate: function(name, params)
        {
            template = {};
            template.name = name;
            template.params = params;
            template.gender = "female";
            template.groups = [];
            template.descriptors = [];
            template.allowedRaces = [];
            template.disallowedRaces = [];
            template.allowedAttributes = [];
            template.disallowedAttributes = [];
            template.forceIfAttributes = [];
            template.weightRange = ["", ""];
            template.allowUnique = true;
            template.allowNonUnique = true;
            template.allowRandom = true;
            template.probabilityWeighting = 1;
            return template;
        },

        addNPCtoForceList: function(currentNPC, forcedNPCAssignments)
        {
            let obj = this.createForcedNPC(currentNPC);

            let bFound = false;
            for (let i = 0; i < forcedNPCAssignments.length; i++)
            {
                let matchedFormID = (forcedNPCAssignments[i].formID === obj.formID);
                let matchedPlugin = (forcedNPCAssignments[i].rootPlugin === obj.rootPlugin);
                if (matchedFormID && matchedPlugin)
                {
                    bFound = true;
                    break;
                }
            }
            if (bFound === false)
            {
                forcedNPCAssignments.push(obj);
            }
        },

        createForcedNPC(currentNPC)
        {
            let obj = {};
            obj.name = currentNPC.name;
            obj.formID = currentNPC.formID;
            obj.formID = "xx" + obj.formID.substring(2, 9);
            obj.EDID = currentNPC.EDID;
            obj.rootPlugin = currentNPC.rootPlugin;
            obj.race = currentNPC.race;
            obj.gender = currentNPC.gender;
            obj.forcedAssetPack = "";
            obj.forcedSubgroups = [];
            obj.forcedHeight = "";
            obj.forcedBodyGenMorphs = [];
            obj.displayString = obj.name + " (" + obj.formID + ")";

            return obj;
        },

        copyObjectArrayInto: function(copyFrom, copyTo, bRemoveDuplicates)
        {
            if (bRemoveDuplicates === undefined)
            {
                bRemoveDuplicates = false;
            }

            for (let key in copyFrom)
            {
                if (copyTo[key] === undefined)
                {
                    copyTo[key] = [];
                }

                if (bRemoveDuplicates === false)
                {
                    copyTo[key].push(...copyFrom[key]);
                }
                else
                {
                    for (let i = 0; i < copyFrom[key].length; i++)
                    {
                        if (copyTo[key].includes(copyFrom[key][i]) === false)
                        {
                            copyTo[key].push(copyFrom[key][i]);
                        }
                    }
                }
            }
        },

        trimArraysToIntersection: function (array1, array2, verboseMode, verboseLogger) // edits both arrays by memory so that they only contain mutually common elements. Returns by address
        {
            this.getArrayIntersectionWithTarget(array1, array2, verboseMode, verboseLogger);
            this.getArrayIntersectionWithTarget(array2, array1, verboseMode, verboseLogger);
        },

        getArrayIntersectionWithTarget(mutable, immutable, verboseMode, verboseLogger)
        {
            let tmp = "";
            let removed = [];
            if (verboseMode === true)
            {
                tmp ="\nArray1 Contents: ";
                for (let i = 0; i < mutable.length; i++)
                {
                    tmp += mutable[i];
                    if (i < mutable.length - 1) { tmp += ", "; }
                }
                tmp += "\nArray2 Contents: ";
                for (let i = 0; i < immutable.length; i++)
                {
                    tmp += immutable[i];
                    if (i < immutable.length - 1) { tmp += ", "; }
                }
                tmp += "\n";
                verboseLogger(tmp);
            }

            // process array 1
            for (let i = 0; i < mutable.length; i++)
            {
                if (immutable.includes(mutable[i]) === false)
                {
                    removed.push(mutable[i]);
                    mutable.splice(i, 1);
                    i--;
                }
            }

            if (verboseMode === true && removed.length > 0)
            {
                tmp = "Array2 does not include ";
                for (let i = 0; i < removed.length; i++)
                {
                    tmp += "\"" + removed[i]  + "\"";
                    if (i < removed.length - 1)
                    {
                        tmp += ", "
                    }
                }
                verboseLogger(tmp + " from Array1. Removing from Array2.")
            }
        },

        removeArrayDuplicates: function (removeFrom, checkAgainst) // if an element appears in both removeFrom and checkAgainst, it will be removed from removeFrom
        {
            for (let i = 0; i < removeFrom.length; i++)
            {
                if (checkAgainst.includes(removeFrom[i]))
                {
                    removeFrom.splice(i, 1);
                    i--;
                }
            }
        },

        removeArrayDuplicatesByValue: function (removeFrom, checkAgainst) // if an element appears in both removeFrom and checkAgainst, it will be removed from removeFrom
        {
            for (let i = 0; i < removeFrom.length; i++)
            {
                if (this.bArrayContainsByValue(removeFrom[i], checkAgainst))
                {
                    removeFrom.splice(i, 1);
                    i--;
                }
            }
        },

        bArrayContainsByValue: function(value, array)
        {
            for (let i = 0; i < array.length; i++)
            {
                if (angular.equals(value, array[i]))
                {
                    return true;
                }
            }
            return false;
        },

        // returns array of unique elements from InputArray
        getArrayUniques: function(inputArray)
        {
            return [...new Set(inputArray)]; /// ... is spread operator, spreads the set back into an array. Set takes only unique values from array.
        },

        getArrayUniquesByValue: function (inputArray)
        {
            let ref = [];
            let bMatched = false;
            for (let i = 0; i < inputArray.length; i++)
            {
                bMatched = false;
                for (let j = 0; j < ref.length; j++)
                {
                    if (angular.equals(inputArray[i], ref[j]))
                    {
                        bMatched = true;
                        break;
                    }
                }
                if (bMatched === false)
                {
                    ref.push(inputArray[i]);
                }
            }
            return ref;
        },

        replaceGroupDefWithIndividuals: function (inputArray, restrictionGroupDefs) // replaces restrictionGroup name definitions with their constituent individual components
        {
            let toReturn = [];
            let match_found = false;
            for (let i = 0; i < inputArray.length; i++)
            {
                match_found = false;
                for (let j = 0; j < restrictionGroupDefs.length; j++)
                {
                    if (restrictionGroupDefs[j].name === inputArray[i])
                    {
                        match_found = true;
                        toReturn.push(...restrictionGroupDefs[j].entries);
                        break;
                    }
                }
                if (match_found === false)
                {
                    toReturn.push(inputArray[i]); // if restrictionGroupDefs didn't contain the given string, assume that string is the name of an actual record rather than a group.
                }
            }
            return toReturn;
        },

        addMissingArrayElements: function(addFrom, addTo)
        {
            for (let i = 0; i < addFrom.length; i++)
            {
                if (addTo.includes(addFrom[i]) === false)
                {
                    addTo.push(addFrom[i]);
                }
            }
        },

        // this is a recursive function that combines n columns of m rows into the n*m possible permutations
        // permutations is the input subgroups arranged into columns to be combined
        // (ex [head1, head2], [body1, body2], [hands1, hands2]).
        // the output from the example above is [[head1, body1, hands1], [head1, body1, hands2], [head1, body2, hands1], etc..]
        generateCombinationsOfArrays: function (permutations)
        {
            let combinationsFromThisLayer = []; // combinations from this layer of recursion.
            let tmpCombinations = [];
            // check if there are any variatns in this subarray
            if (permutations.length === 1)
            {
                return permutations[0];
            } // if in the bottom layer, simply return the last array column

            // otherwise, split the current array into the first column and all other columns
            let firstColumn = permutations[0];
            // iterate through the first column ([head1, head2])

            // create a subArray of all other columns
            let otherColumns = permutations.slice(1); // slice function without a second parameter returns subarray from 1 to the end of the array).

            let concats = this.generateCombinationsOfArrays(otherColumns); // recursively call this function to generate all permutation combinations from the columns to the right of this one.

            // now iterate through every subgroup in the first column and combine it with the recrusively-generated combinations (concats) from the other columns
            for (let i = 0; i < firstColumn.length; i++)
            {
                for (let j = 0; j < concats.length; j++)
                {
                    tmpCombinations = [];
                    tmpCombinations.push(firstColumn[i]); // add the current iteration of the first column
                    if (otherColumns.length === 1)
                    {
                        tmpCombinations.push(...new Array(concats[j]));
                    } else
                    {
                        tmpCombinations.push(...concats[j]);
                    }
                    combinationsFromThisLayer.push(tmpCombinations); // add the combined array (first column + permutation from other columns) to the return array for this layer.
                }
            }

            return combinationsFromThisLayer;
        },

        // this function changes an array to match newArray without losing its reference.
        replaceArrayValues: function(arrayToUpdate, newArray)
        {
            arrayToUpdate.length = 0; // clear the array without losing reference
            newArray.forEach(x => arrayToUpdate.push(x));
        }, 

        combineDictionaries: function(inputDicts)
        {
            let outputDict = {};
            for (let i = 0; i < inputDicts.length; i++)
            {
                Object.assign(outputDict, inputDicts[i]);
            }

            return outputDict;
        },

        // This function searches for at a path relative to a record, including within subrecords, and returns bool if valueToMatch was found at that path.
        bAttributeMatched: function(attributePath, valueToMatch, NPCrecordHandle, logMessage, xelib, attributeCache)
        {
            let valuesAtPath = attributeCache[attributePath];

            if (valuesAtPath === undefined)
            {
                valuesAtPath = this.getValueAtESPpath(NPCrecordHandle, attributePath, xelib, logMessage, true); // note: returns array because getValueAtESPpath can look through arrays at arbitrary indices and returna all corresponding values.
                attributeCache[attributePath] = valuesAtPath;
            }
            
            valueToMatch = valueToMatch.trim();

            return valuesAtPath.includes(valueToMatch);
        },

        // this function returns an array of values found at path
        // Array indices are denoted in the path by "\*\"
        // returns array because if there are multiple array elements within the path then there can be multiple instances of the path.
        getValueAtESPpath: function(handle, path, xelib, logMessage, bQuiet)
        {
            let pathSplit = path.split('\\');
            let toReturn = [];
            parseValueAtESPpath(handle, pathSplit, pathSplit[0], 0, xelib, toReturn, logMessage, bQuiet);
            return toReturn;
        },

        heightConfigIncludesRace: function(heightConfig, raceEDID)
        {
            for (let i = 0; i < heightConfig.length; i++)
            {
                if (heightConfig[i].EDID === raceEDID)
                {
                    return true;
                }
            }
            return false;
        },

        padHeightConfig: function(heightConfig)
        {
            for (let i = 0; i < heightConfig.length; i++)
            {
                heightConfig[i].heightMale = this.padValue(heightConfig[i].heightMale, 6);
                heightConfig[i].heightFemale = this.padValue(heightConfig[i].heightFemale, 6);
            }
        },

        padValue: function(sNumber, paddingZeroCount)
        {
            let tmp = sNumber.split('.');
            if (tmp.length === 1)
            {
                tmp.push("");
            }

            for (let i = tmp[1].length; i < paddingZeroCount; i++)
            {
                tmp[1] += "0";
            }

            return tmp[0] + "." + tmp[1];
        },

        isObject: function(val) 
        {
            if (val === null) { return false;}
            return (typeof val === 'object');
        },

        
        updateFailureModes: function(failureModes, failureModeString)
        {
            if (failureModes[failureModeString] === undefined)
            {
                failureModes[failureModeString] = 1;
            }
            else
            {
                failureModes[failureModeString]++;
            }
        },

        formatFailureModeString: function(failureModes, keyword, optionalSpecifier)
        {
            let s = "Reasons that no " + keyword + " could be assigned";
            if (optionalSpecifier === undefined)
            {
                s += ":";
            }
            else
            {
                s += " for " + optionalSpecifier + ":";
            }

            for (let mode in failureModes)
            {
                s += "\n" + mode + ": " + failureModes[mode].toString();

                if (mode === 1)
                {
                    s += " " + keyword;
                }
                else
                {
                    s += " " + keyword + "s";
                }
            }

            return s;
        },

        formatFailureModeString_consistency: function(failureModes, keyword)
        {
            let s = "Consistency " + keyword + " could not be assigned due to: ";

            for (let mode in failureModes)
            {
                s += mode;
            }

            return s;
        },

        assignValueToObjectPath: function(path, recipientObject, valueToAssign)
        {
            let pSplit = path.split('\\');
            subPath = path.substring(pSplit[0].length + 1, path.length);

            // if there is only one array element in pSplit, assign valueToAssign to that element of recipientObject
            if (pSplit.length === 1)
            {
                recipientObject[pSplit[0]] = valueToAssign;
            }

            else
            {
                // check if the next pSplit entry is an array
                let arrIndex = this.getArrayIndexFromBrackets(pSplit[1]);

                if (arrIndex >= 0) // if array
                {
                    // get rid of the array index in subPath
                    let toRemove = "[" + arrIndex + "]";
                    let toRemoveStart = subPath.indexOf(toRemove);
                    let toRemoveEnd = toRemoveStart + toRemove.length;
                    subPath = subPath.substring(toRemoveEnd, subPath.length);
                    subPath = this.trimSlashes(subPath);
                    //

                    // check if the valueToAssign is to be assigned directly into the recipientObject at this array index, or if it goes into a sub-value
                    if (subPath === "")
                    {
                        recipientObject[pSplit[0]][arrIndex] = valueToAssign;
                    }
                    else
                    {
                        this.assignValueToObjectPath(subPath, recipientObject[pSplit[0]][arrIndex], valueToAssign);
                    }
                }
                else // if object
                {
                    this.assignValueToObjectPath(subPath, recipientObject[pSplit[0]], valueToAssign);
                }
            }   
        },

        getValueAtObjectPath: function(path, searchObject)
        {
            let pSplit = path.split('\\');
            subPath = path.substring(pSplit[0].length + 1, path.length);

            // if the path doesn't exist, return false
            if (!(pSplit[0] in searchObject))
            {
                return undefined;
            }

            // if there is only one array element in pSplit, get the value of the object at that path
            if (pSplit.length === 1)
            {
                return searchObject[pSplit[0]];
            }

            else
            {
                // check if the next pSplit entry is an array
                let arrIndex = this.getArrayIndexFromBrackets(pSplit[1]);

                if (arrIndex >= 0) // if array
                {
                    // get rid of the array index in subPath
                    let toRemove = "[" + arrIndex + "]";
                    let toRemoveStart = subPath.indexOf(toRemove);
                    let toRemoveEnd = toRemoveStart + toRemove.length;
                    subPath = subPath.substring(toRemoveEnd, subPath.length);
                    subPath = this.trimSlashes(subPath);
                    //

                    // check if the valueToAssign is to be assigned directly into the searchObject at this array index, or if it goes into a sub-value
                    if (subPath === "")
                    {
                        return searchObject[pSplit[0]][arrIndex];
                    }
                    else
                    {
                        return this.getValueAtObjectPath(subPath, searchObject[pSplit[0]][arrIndex]);
                    }
                }
                else // if object
                {
                    return this.getValueAtObjectPath(subPath, searchObject[pSplit[0]]);
                }
            }   
        },

        getValueAtObjectPath2: function(path, obj) // this does NOT handle invalid paths due to the commented out code (to speed up function - invalid paths not expected here)
        {
            let pathArr = path.split('\\');

            for (let i=0; i<pathArr.length; i++)
            {
                /*if (obj[pathArr[i]] === undefined)
                {
                    return undefined;
                }
                else*/ if (Array.isArray(obj[pathArr[i]]))
                {
                    //strip leading and trailing brackets from array index
                    pathArr[i+1] = parseInt(pathArr[i+1].substring(1, pathArr[i+1].length - 1));
                    obj = obj[pathArr[i]][pathArr[i+1]];
                    i++;
                }
                else
                {
                    obj = obj[pathArr[i]];
                }
            };
            return obj;
        },

        assignValueToObjectPath2: function(path, obj, value) // this does NOT handle invalid paths due to the commented out code (to speed up function - invalid paths not expected here)
        {
            let pathArr = path.split('\\');

            for (let i=0; i<pathArr.length - 1; i++)
            {
                if (obj.zEBDUniqueID !== undefined)
                {
                    if (obj.zEBDpathSignature === undefined)
                    {
                        obj.zEBDpathSignature = "";
                    }
                    else
                    {
                        obj.zEBDpathSignature += "|"
                    }
                    obj.zEBDpathSignature += value;
                }
                /*if (obj[pathArr[i]] === undefined)
                {
                    return undefined;
                }
                else*/ if (Array.isArray(obj[pathArr[i]]))
                {
                    //strip leading and trailing brackets from array index
                    pathArr[i+1] = parseInt(pathArr[i+1].substring(1, pathArr[i+1].length - 1));
                    obj = obj[pathArr[i]][pathArr[i+1]];
                    i++;
                }
                else
                {
                    obj = obj[pathArr[i]];
                }
            };
            obj[pathArr[pathArr.length - 1]] = value;
        },
        
        getAllValuesInObject: function(object, storageList, searchTerm)
        {
            if (object[searchTerm] !== undefined)
            {
                storageList.push(object[searchTerm]);
            }
            
            for (let [attribute, value] of Object.entries(object))
            {
                if (Array.isArray(value))
                {
                    for (let i = 0; i < value.length; i++)
                    {
                        if (this.isObject(value[i]))
                        {
                            this.getAllValuesInObject(value[i], storageList, searchTerm);
                        }
                    }
                }

                else if (this.isObject(value))
                {
                    this.getAllValuesInObject(value, storageList, searchTerm);
                }
            }
        },

        
        // Compiles the original record-templates and their sub-records into a flat 1D list
        flattenZEBDSubRecords: function(record, templateList) 
        {    
            if (record.zEBDUniqueID !== undefined) // check if the record is an zEBDrecord
            { 
                templateList.push(record);    
            }

            if (this.isObject(record) === true)
            {
                for (let [attribute, value] of Object.entries(record))
                {
                    if (Array.isArray(value))
                    {
                        for (let j = 0; j < value.length; j++)
                        {
                            this.flattenZEBDSubRecords(value[j], templateList); // recursively check each element to see if it is a template record
                        }
                    }
                    else if (value != null)
                    {
                        this.flattenZEBDSubRecords(value, templateList);
                    }
                }
            }
            return record;
        },


        getArrayIndexFromBrackets: function(str)
        {
            str = str.substring(1, str.length);
            str = str.substring(0, str.length - 1);

            let index = parseInt(str);
            if (this.isValidNumber(index) === false)
            {
                return -1;
            }
            else
            {
                return index;
            }
        },

        trimSlashes: function(str)
        {
            if (str.length === 0)
            {
                return str;
            }
            
            if (str[0] === "\\")
            {
                str = str.substring(1, str.length);
            }

            if (str[str.length - 1] === "\\")
            {
                str = str.substring(0, str.length - 1);
            }
            return str;
        }
};

// this function retreives an element value at path attributePath relative to NPCrecordHandle
// attributePath can include records referenced within NPCrecordHandle.
function parseValueAtESPpath(handle, pathArray, rebuiltPath, index, xelib, toReturn, logMessage, bQuiet)
{
    let currentPath = rebuiltPath;
    let currentPathArray = angular.copy(pathArray); // need copy because will be manipulating elements. Carryover will interfere with other recursions because pathArray is accessed by reference
    //let currentPathArray = pathArray.slice();
    // TRY SLICE FOR ABOVE
    if (currentPathArray[index] === "*") // indicates arbitrary array element. Recursively call on all array elements. This check has to go first or else the followeing HasElement check returns false.
    {
        rebuiltPath = currentPath.replace("*", "");
        try
        {
            let elements = xelib.GetElements(handle, rebuiltPath);
            for (let element = 0; element < elements.length; element++)
            {
                currentPath = rebuiltPath + "[" + element.toString() + "]";
                currentPathArray[index] = "[" + element.toString() + "]";
                if (bQuiet === false) { logMessage("Now entering element " + element.toString() + " of array at " + rebuiltPath); }
                parseValueAtESPpath(handle, currentPathArray, currentPath, index, xelib, toReturn, logMessage, bQuiet); // index does not get incremented because this is a re-run of current position within the pathArray, just with an index instead of the * indicator
            }
        } catch (e)
        {
            logMessage("parseValueAtESPpath(): Error handling array at path: ", currentPath);
        }
    }

    else if (xelib.HasElement(handle, rebuiltPath) === false) // not all records will have all elements filled. Quietly return if this record doesn't have the given element
    {
        if (bQuiet === false) { logMessage("Could not find an element at path: " + rebuiltPath); }
        return;
    }
    else if (index === pathArray.length - 1) // if this layer of recursion is the last layer, this should point to the value. Get the value or return undefined.
    {
        try
        {
            toReturn.push(xelib.GetValue(handle, currentPath));
            if (bQuiet === false) { logMessage("Found value \"" + toReturn[toReturn.length - 1] + "\" at path " + currentPath); }
            return;
        } catch (e)
        {
            logMessage("parseValueAtESPpath(): Error getting value at path: ", currentPath);          
            return;
        }
    }

    // if the current path points to a record, switch the handle to it and clear the currentPath so that it's relative to the new handle
    else if (xelib.ValueType(xelib.GetElement(handle, currentPath)) === 5) // ValueType 5 = vtReference.
    {
        handle = xelib.GetLinksTo(handle, currentPath);
        if (bQuiet === false) { helpers.logMessage("Now record entering " + debug1 + " at path " + currentPath); }
        currentPath = currentPathArray[index + 1];
        parseValueAtESPpath(handle, currentPathArray, currentPath, index + 1, xelib, toReturn, logMessage, bQuiet);
    }

    else // if this section of the path is not an array, move on by adding this section.
    {
        currentPath += "\\" + currentPathArray[index + 1];
        parseValueAtESPpath(handle, currentPathArray, currentPath, index + 1, xelib, toReturn, logMessage, bQuiet);
    }

}