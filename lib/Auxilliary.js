debugger;
module.exports =
    {
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
            template.probabilityWeighting = 1;
            return template;
        },

        copyArrayInto: function (copyFrom, copyTo) // arrays edited by pointer - no return value
        {
            for (let i = 0; i < copyFrom.length; i++)
            {
                copyTo.push(copyFrom[i]);
            }
        },

        copyObjectArrayInto: function(copyFrom, copyTo)
        {
            for (let key in copyFrom)
            {
                if (copyTo[key] === undefined)
                {
                    copyTo[key] = [];
                }
                this.copyArrayInto(copyFrom[key], copyTo[key]);
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

        // returns array of unique elements from InputArray
        getArrayUniques: function(inputArray)
        {

            return [...new Set(inputArray)]; /// ... is spread operator, spreads the set back into an array. Set takes only unique values from array.
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
                        this.copyArrayInto(restrictionGroupDefs[j].entries, toReturn);
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
                        this.copyArrayInto(new Array(concats[j]), tmpCombinations)
                    } else
                    {
                        this.copyArrayInto(concats[j], tmpCombinations);
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