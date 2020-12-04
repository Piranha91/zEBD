debugger;
// contains legacy code from versions <1.9 to simulate permutation buildup
let Aux = require('./Auxilliary');

let permutationBuildupLogString = "";

module.exports = function(modulePath, fh)
{
    let PS = {};

    PS.simulateAssetPackPermutations = function (assetPack, raceGroupDefinitions, patcherSettings)
    {
        let variants = []; // array of bottom-level variants corresponding to top-level subgroup positions
        let currentSubgroupVariant = [];
        let permutations = [];

        // get the subgroups at the bottom of each subgroup stack (e.g all possible branches of the subgroup tree). Copy the paths and restrictions from non-terminal nodes into the terminal ones (because otherwise they're not returned).

        variants = [];
        logPermutationBuildup(undefined, assetPack.groupName);
        for (let j = 0; j < assetPack.subgroups.length; j++) // generate every possible variant of each top-level subgroup. Each subgroup must be a unique object rather than a shared reference address.
        {
            generateSubgroupVariants(assetPack.subgroups[j], currentSubgroupVariant, new transferSubgroupInfo(), raceGroupDefinitions, assetPack.subgroups, patcherSettings.bEnableBodyGenIntegration);
            variants.push(currentSubgroupVariant);
            currentSubgroupVariant = [];
        }

        // now variants is an array containing n sub-arrays. n = number of top-level subgroups (to be combined together); each array contains all sub-members of these top-level subgroups, to which parent subgroup data (if any) has been forwarded.
        // now generate a single array that contains all possible combinations of the n sub-arrays.

        permutations = generatePermutations(variants, raceGroupDefinitions, assetPack.subgroups, patcherSettings.bEnableBodyGenIntegration);

        savePermutationBuildupLog (assetPack.groupName, modulePath, fh);        
    }

    return PS;
}

class transferSubgroupInfo
{
    constructor() // this is only ever used to create the empty parent subgroup for the first recursion of generateSubgroupVariants()
    {
        this.id = "";
        this.distributionEnabled = true;
        this.probabilityWeighting= 1; // default to 1 so that multiplication doesn't get messed up during first recursion, when this constructor is called for the parent subgroup.
        this.allowUnique =  true;
        this.allowNonUnique = true;
        this.allowedRaces = [];
        this.disallowedRaces = [];
        this.allowedAttributes = [];
        this.disallowedAttributes = [];
        this.forceIfAttributes = [],
        this.weightRange = [NaN, NaN],
        this.requiredSubgroups = {}; /// NOTE THIS IS OBJECT NOT ARRAY
        this.excludedSubgroups = [];
        this.containedSubgroupIDs = []; // used to capture the path traversed to the final subgroup nodes, because otherwise the non-terminal node IDs are lost. These are needed for the final required/excludedSubgroups check
        this.containedSubgroupNames = []; // same as above, but for names
        this.addKeywords = [],
        this.paths = [];
        this.emptyFlagAR = true; // defaults to true, make sure to set to false if allowedRaces gets populated
        this.allowedBodyGenDescriptors = {}; /// NOTE THIS IS OBJECT NOT ARRAY
        this.disallowedBodyGenDescriptors = [];
    }
}

function generateSubgroupVariants(subgroup, permArray, parentSubgroup, restrictionGroupDefs, subgroupHierarchy, bEnableBodyGenIntegration)
{
    let split = [];
    let category = "";
    let value = "";

    // if the subgroup is disabled, return (neither this subgroup nor downstream branches will be loaded into permArray
    if (subgroup.enabled === false)
    {
        return;
    }
    // copy any existing restrictions and paths in the parent transferSubgroupInfo object from previous recursion into a new variable (to avoid modifying the array for recursions that don't go down this branch)
    let pSGclone = angular.copy(parentSubgroup);
    // deep clone the subgroup to avoid making changes to it. Directly editing subgroup result in changes that are carried back to the user's settings JSON file (effectively piling all of the upper-level paths and restrictions into the lowest level nodes)
    let sgClone = angular.copy(subgroup);

    if (sgClone.allowedRaces.length === 0)
    {
        sgClone.emptyFlagAR = true; // this is necessary because sgClone is NOT a transferSubgroupInfo but an object loaded from the settings json file which does NOT have an emptyFlagAR attribute.
    }
    else 
    { 
        sgClone.emptyFlagAR = false;
        sgClone.allowedRaces = Aux.replaceGroupDefWithIndividuals(sgClone.allowedRaces, restrictionGroupDefs);
    }

    if (sgClone.disallowedRaces.length !== 0)
    {
        sgClone.disallowedRaces = Aux.replaceGroupDefWithIndividuals(sgClone.disallowedRaces, restrictionGroupDefs); 
    }

    // convert requiredSubgroups into an object for easier processing
    if (sgClone.requiredSubgroups.length > 0) // convert the requiredSubgroups array[string] into an array[string, int], where array[0] is the required subgroupID (the original requiredSubgroups[i]) and array[1] is the index of the top-level subgroup within which that subgroup is found
    {
        let reqTemp = {};
        let rSindex = -1;
        for (let i = 0; i < sgClone.requiredSubgroups.length; i++)
        {
            rSindex = Aux.getSubgroupTopLevelIndex(sgClone.requiredSubgroups[i], subgroupHierarchy);
            if (reqTemp[rSindex] === undefined)
            {
                reqTemp[rSindex] = new Array(sgClone.requiredSubgroups[i]);
            }
            else
            {
                reqTemp[rSindex].push(sgClone.requiredSubgroups[i])
            }
        }
        sgClone.requiredSubgroups = reqTemp;
    }

    else 
    {
        sgClone.requiredSubgroups = {};
    }
    //

    // convert allowedBodyGenDescriptors into an object for easier processing
    let aBGDtemp = {};
    if (sgClone.allowedBodyGenDescriptors.length > 0)
    {
        for (let i = 0; i < sgClone.allowedBodyGenDescriptors.length; i++)
        {
            split = sgClone.allowedBodyGenDescriptors[i].split(":");
            category = split[0].trim();
            value = split[1].trim();

            if (aBGDtemp[category] === undefined)
            {
                aBGDtemp[category] = new Array(value);
            }
            else
            {
                aBGDtemp[category].push(value);
            }
        }
    }
    sgClone.allowedBodyGenDescriptors = aBGDtemp;
    
    // convert disallowedBodyGenDescriptors into an array of arrays for easier processing
    if (sgClone.disallowedBodyGenDescriptors.length > 0)
    {
        let daBGDtemp = [];
        let daBG = {};
        for (let i = 0; i < sgClone.disallowedBodyGenDescriptors.length; i++)
        {
            daBG = {};
            split = sgClone.disallowedBodyGenDescriptors[i].split(':');
            daBG.category = split[0].trim();
            daBG.value = split[1].trim();
            daBGDtemp.push(daBG);
        }
        sgClone.disallowedBodyGenDescriptors = daBGDtemp;
    }
    
    // convert weight range into numbers for easier processing
    sgClone.weightRange[0] = parseFloat(sgClone.weightRange[0]);
    sgClone.weightRange[1] = parseFloat(sgClone.weightRange[1]);

    // check if the current subgroup restrictions conflict with those from upstream subgroups. Trim the restrictions to comply with those upstream if possible, or return to previous recursion layer otherwise.
    let conflictsResolved = bResolveSubgroupParentConflicts(sgClone, pSGclone, subgroupHierarchy, bEnableBodyGenIntegration); // note that this function will modify both sgClone and transferSubGroupInfo to trim restrictions that are incompatible with upstream/downstream ones.
    // if irreconcilable conflict, return without adding this subgroup to the output array (permArray)
    if (conflictsResolved === false) { return;}
    // Otherwise, copy paths and restrictions from upper level recursions into the sgClone to be returned

    sgClone.probabilityWeighting *= pSGclone.probabilityWeighting; // multiply the probability weighting of the parent and current subgroup
    sgClone.containedSubgroupIDs = []; // For collecting traversed subgroupIDs (otherwise only the end node IDs are returned)
    sgClone.containedSubgroupNames = []; // for collecting names of traversed subgroups
    sgClone.parentSubgroups = [];

    Aux.copySubgroupComponents(pSGclone, sgClone); // Now that conflicts between current subgroup and parent have been resolved, copy parent subgroup info into current subgroup info.
    sgClone.containedSubgroupIDs.push(sgClone.id);
    sgClone.containedSubgroupNames.push(sgClone.name);

    if (subgroup.subgroups === undefined || subgroup.subgroups.length === 0) // if there are no sublayers, return this sublayer with restrictions and path carried from upper layers
    {
        permArray.push(sgClone); // return this subgroup
    }

    else
    {
        // continue to the next recursion for each subgroup
        for (let i = 0; i < subgroup.subgroups.length; i++)
        {
            generateSubgroupVariants(subgroup.subgroups[i], permArray, sgClone, restrictionGroupDefs, subgroupHierarchy, bEnableBodyGenIntegration);
        }
    }
}

// this function generates all possible combinations of the permutations derived from top-level subgroups
// combinations are checked for internal subgroup compatibility as they are being built, and discarded if internal subgroups are mutually exclusive
function generatePermutations(variants, restrictionGroupDefs, subgroupHierarchy, bEnableBodyGenIntegration)
{
    let combinationsFromThisLayer = []; // combinations from this layer of recursion.
    let subGroupA;
    let permutationB;
    let PH;
    let currentSubgroupPos = 0; // index of the current subgroup being added to the permutation, in the context of the final permutation. Initialize to zero in case the previous recursion fails to return any subPermutations

    // check if there are any variants in this subarray
    if (variants.length === 1) // if in the bottom layer, simply return the last array column
    {
        for (let i = 0; i < variants[0].length; i++)
        {
            PH = new permutationHolder("");
            if (variants[0][i].emptyFlagAR === true)
            {
                PH.emptyFlagAR = true;
            }
            permutationHolder.appendSubgroupToPH(variants[0][i], PH);
            combinationsFromThisLayer.push(PH);
        }
        logPermutationBuildup(combinationsFromThisLayer, undefined);
        return combinationsFromThisLayer;
    } 

    // otherwise, split the current array into the first column and all other columns
    let firstColumn = variants[0];

    // iterate through the first column ([head1, head2])

    // create a subArray of all other columns
    let otherColumns = variants.slice(1); // slice function without a second parameter returns subarray from 1 to the end of the array).

    let subPermutations = generatePermutations(otherColumns, restrictionGroupDefs, subgroupHierarchy, bEnableBodyGenIntegration); // recursively call this function to generate all permutation combinations from the columns to the right of this one.

    // get index of the current subgroup(s) to be added within the final permutation array
    if (subPermutations.length > 0)
    {
        currentSubgroupPos = getIndexInFinalArray(0, subPermutations[0].contributingBottomLevelSubgroupIDs.length + 1, subgroupHierarchy.length);
    }
    
    // now iterate through every subgroup in the first column and combine it with the recrusively-generated combinations (subPermutations) from the other columns

    for (let i = 0; i < firstColumn.length; i++)
    {     
        for (let j = 0; j < subPermutations.length; j++)
        {
            // check if RequiredSubgroups and ExcludedSubgroups are compatible between the new subgroup to be added (firstColumn[i]) and the subpermutation with which it will be combined (subPermutations[j])
            if (checkPermutationRequireAllowExclude(firstColumn[i], subPermutations[j], subgroupHierarchy, currentSubgroupPos) === true) // this is a separate function from bResolveSubgroupPermutationConflicts_Legacy() to avoid wasting time on unnecessary angular.copy() calls
            {
                subGroupA = angular.copy(firstColumn[i]); // make copy to avoid mutating original object for other permutations
                permutationB = angular.copy(subPermutations[j]);     // make copy to avoid mutating original object for other permutations

                // handle compatibility between subgroupA and permutationB (allowedRaces, ExcludedRaces, etc), making edits if necessary
                if (bResolveSubgroupPermutationConflicts_Legacy(subGroupA, permutationB, subgroupHierarchy, bEnableBodyGenIntegration) === true)
                {                 
                    permutationHolder.appendSubgroupToPH(subGroupA, permutationB);
                    combinationsFromThisLayer.push(permutationB);
                }
            }   
        }   
    }

    logPermutationBuildup(combinationsFromThisLayer, undefined);

    return combinationsFromThisLayer;
}

function checkPermutationRequireAllowExclude(currentSubgroup, subPermutation, subgroupHierarchy, currentSubgroupPos)     // currentSubGroupPos is position of the subgroup being added
{
    let innerSubgroupPos;
    let requiredSubgroupsFulfillmentTracker = {};
    let s_currentSubgroupPos = currentSubgroupPos.toString(); // necessary because requiredSubgroups are objects with the top-level subgroup indices (in string format) as keys

    let matched_index = false;
    let matched_requiredSubgroup = false;
    let tracker_empty = false;
        
    // check required subgroups in the existing subPermutation
    
    for (let index in subPermutation.requiredSubgroups)
    {
        for (let i = 0; i < subPermutation.requiredSubgroups[index].length; i++)
        {
            matched_index = (s_currentSubgroupPos === index);
            matched_requiredSubgroup = (currentSubgroup.containedSubgroupIDs.includes(subPermutation.requiredSubgroups[index][i]));
            tracker_empty = (requiredSubgroupsFulfillmentTracker[s_currentSubgroupPos] === undefined);

            if (matched_index === true && matched_requiredSubgroup === false && tracker_empty === true)
            {   
                requiredSubgroupsFulfillmentTracker[s_currentSubgroupPos] = false;
            }
            // if the new subgroup's ID does match, record it
            else if (matched_index === true && matched_requiredSubgroup === true)
            {
                requiredSubgroupsFulfillmentTracker[s_currentSubgroupPos] = true;
            }
        }
    }

    // loop through the fulfillment tracker - if any index is unfulfilled, return false
    for (let index in requiredSubgroupsFulfillmentTracker)
    {
        if (requiredSubgroupsFulfillmentTracker[index] === false)
        {
            return false;
        }
    }

    // check required subgroups in the new subgroup.
    requiredSubgroupsFulfillmentTracker = {};
    for (let index in currentSubgroup.requiredSubgroups)
    {
        for (let i = 0; i < currentSubgroup.requiredSubgroups[index].length; i++)
        {
            for (let j = 0; j < subPermutation.contributingSubgroupIDs.length; j++)
            {
                innerSubgroupPos = getIndexInFinalArray(j, subPermutation.contributingSubgroupIDs.length, subgroupHierarchy.length).toString(); // innerSubgroupPos is the position of the subgroup (from within the subpermutation) being examined

                matched_index = (innerSubgroupPos === index);
                matched_requiredSubgroup = (subPermutation.contributingSubgroupIDs[j].includes(currentSubgroup.requiredSubgroups[index][i]));
                tracker_empty = (requiredSubgroupsFulfillmentTracker[innerSubgroupPos] === undefined);

                if (matched_index === true && matched_requiredSubgroup === false && tracker_empty === true)
                {
                    requiredSubgroupsFulfillmentTracker[innerSubgroupPos] = false;
                }
                else if (matched_index === true && matched_requiredSubgroup === true)
                {
                    requiredSubgroupsFulfillmentTracker[innerSubgroupPos] = true;
                }
            }
        }
    }

    // loop through the fulfillment tracker - if any index is unfulfilled, return false
    for (let index in requiredSubgroupsFulfillmentTracker)
    {
        if (requiredSubgroupsFulfillmentTracker[index] === false)
        {
            return false;
        }
    }

    // look through subgroup's excluded subgroups to see if any are contained within the permutation
    for (let i = 0; i < currentSubgroup.excludedSubgroups.length; i++)
    {
        for (let j = 0; j < subPermutation.contributingBottomLevelSubgroupIDs.length; j++)
        {
            if (subPermutation.contributingSubgroupIDs[j].includes(currentSubgroup.excludedSubgroups[i]))
            {
                return false;
            }
        }
    }

    // look through permutation's excluded subgroups to see if any match the subgroup
    for (let i = 0; i < subPermutation.excludedSubgroups.length; i++)
    {
        if (currentSubgroup.containedSubgroupIDs.includes(subPermutation.excludedSubgroups[i]))
        {
            return false;
        }
    }

    return true;
}

function getIndexInFinalArray(index, currentLength, maxLength)
{
    return maxLength - currentLength + index;
}

function bResolveSubgroupParentConflicts(subgroup, parent, subgroupHierarchy, bEnableBodyGenIntegration)
{
    compatibilizeDistributionEnabled(subgroup, parent);
    compatibilizeAllowUnique(subgroup, parent);
    compatibilizeAllowNonUnique(subgroup, parent);
    
    pruneSubgroupDisallowedRacesFromAllowed(subgroup); // BUGFIX in version 1.9
    if (bCompatibilizeAllowedRaces(subgroup, parent, false) === false) { return false; } // duplicates handled in copy function to avoid logic errors
    if (bCompatibilizeDisallowedRaces(subgroup, parent, false) === false) { return false; } // duplicates handled in copy function to avoid logic errors
    if (bCompatibilizeDisallowedRaces(parent, subgroup, false) === false) { return false; } // duplicates handled in copy function to avoid logic errors. Reverse check to get rid of too-broad allowedRaces in the parent subgroup
    compatibilizeAllowedAttributes(subgroup, parent, true);
    compatibilizeDisallowedAttributes(subgroup, parent, true);
    compatibilizeForceIfAttributes(subgroup, parent, true);
    compatibilizeWeightRange(subgroup, parent);    
    
    if (bCompatibilizeRequiredSubgroups(subgroup, parent, subgroupHierarchy) === false) { return false; } 
    
    if (bCompatibilizeExcludedSubgroups(subgroup, parent) === false)  { return false; } //removeDuplicates = false to avoid screwing up the reverse check on the following line
    if (bCompatibilizeExcludedSubgroups(parent, subgroup) === false)  { return false; } 
    compatibilizePaths(subgroup, parent, true);

    if (bEnableBodyGenIntegration === true)
    {
        if (bCompatibilizeAllowedBodyGen(subgroup, parent, true) === false) { return false; } 
        if (bCompatibilizeDisallowedBodyGen(subgroup, parent, true) === false) { return false; }
    }

    return true;
}

function bResolveSubgroupPermutationConflicts_Legacy (subgroup, permutation, subgroupHierarchy, bEnableBodyGenIntegration)
{
    // the following actually affect assignment:
    if (bCompatibilizeRequiredSubgroups(subgroup, permutation, subgroupHierarchy) === false) { return false; }
    if (bCompatibilizeExcludedSubgroups(subgroup, permutation) === false)  { return false; } // checks only subgroup (removeDuplicates = false to avoid screwing up the reverse check on the following line)
    if (bCompatibilizeExcludedSubgroups(permutation, subgroup) === false)  { return false; } // checks only permutation 
    compatibilizePaths(subgroup, permutation, true);
    if (bEnableBodyGenIntegration === true)
    {
        if (bCompatibilizeAllowedBodyGen(subgroup, permutation, true) === false) { return false; } 
        if (bCompatibilizeDisallowedBodyGen(subgroup, permutation, false) === false) { return false; } // checks only subgroup
        if (bCompatibilizeDisallowedBodyGen(permutation, subgroup, true) === false) { return false; } // checks only permutation
    }

    // the following are for logging purposes only:
    // bRemoveDuplicates must be set to false to handle the allowed/disallowed Races compatibilization. Otherwise the logic fails.
    if (bCompatibilizeAllowedRaces(subgroup, permutation, false) === false) { return false; } // trims only subgroup
    if (bCompatibilizeAllowedRaces(permutation, subgroup, false) === false) { return false; } // trims only permutation     
    if (bCompatibilizeDisallowedRaces(subgroup, permutation, false) === false) { return false; } // checks only subgroup
    if (bCompatibilizeDisallowedRaces(permutation, subgroup, false) === false) { return false; } // checks only permutation
    //allowed/disallowedRaces are trimmed back to their unique constitituents when subgroup is added to permutation in permutationHolder.appendSubgroupToPH
    compatibilizeAllowedAttributes(subgroup, permutation, true); 
    compatibilizeDisallowedAttributes(subgroup, permutation, true);
    compatibilizeForceIfAttributes(subgroup, permutation, true);
    compatibilizeWeightRange(subgroup, permutation);                           

    return true;
};

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
        this.emptyFlagAR = false; // tells the conflict checker function that this subgroup has no allowedRaces due to uesr input rather than conflict pruning
        
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

    static appendSubgroupToPH(subgroup, permutation)
    {
        if (permutation.nameString === "")
        {
            permutation.nameString = subgroup.id;
        }
        else
        {
            permutation.nameString = subgroup.id + "," + permutation.nameString;
        }

        permutation.subgroups.unshift(subgroup); 

        // permutation is built up from last subgroup to first
        // unshift all arrays to keep indices correct 
        // this is important for checkPermutationRequireAllowExclude(), which expects to find subgroups at their correct indices within the permutation)
        permutation.contributingBottomLevelSubgroupIDs.unshift(subgroup.id);
        permutation.contributingSubgroupIDs.unshift(subgroup.containedSubgroupIDs);
        permutation.contributingSubgroupNames.unshift(subgroup.containedSubgroupNames);
        //
        // The remaining permutation elements below are also unshifted to have consistent indices with the above elements, but this is for log legibility and not logical necessity
        Aux.copyObjectArrayInto(subgroup.requiredSubgroups, permutation.requiredSubgroups);
        permutation.excludedSubgroups = [...subgroup.excludedSubgroups, ...permutation.excludedSubgroups];

        permutation.allowedRaces = [...subgroup.allowedRaces, ...permutation.allowedRaces];
        permutation.disallowedRaces = [...subgroup.disallowedRaces, ...permutation.disallowedRaces];

        permutation.allowedRaces = Aux.getArrayUniques(permutation.allowedRaces);
        permutation.disallowedRaces = Aux.getArrayUniques(permutation.disallowedRaces); 

        permutation.allowedAttributes = [...Aux.convertAttributePairsToObjects(subgroup.allowedAttributes, subgroup), ...permutation.allowedAttributes];
        permutation.disallowedAttributes = [...Aux.convertAttributePairsToObjects(subgroup.disallowedAttributes, subgroup), ...permutation.disallowedAttributes];
        permutation.forceIfAttributes = [...Aux.convertAttributePairsToObjects(subgroup.forceIfAttributes, subgroup), ...permutation.forceIfAttributes];
        permutation.weightRange = subgroup.weightRange; // subgroup.weightRange has been compared to permutation.weightRange and is either tighter or the same
        permutation.addKeywords = [...subgroup.addKeywords, ...permutation.addKeywords];
        permutation.paths = [...subgroup.paths, ...permutation.paths];

        if (subgroup.distributionEnabled === false) { permutation.distributionEnabled = false; }
        if (subgroup.allowUnique === false) { permutation.allowUnique = false; }
        if (subgroup.allowNonUnique === false) { permutation.allowNonUnique = false; }
        permutation.probabilityWeighting *= subgroup.probabilityWeighting;

        Aux.copyObjectArrayInto(subgroup.allowedBodyGenDescriptors, permutation.allowedBodyGenDescriptors);
        permutation.disallowedBodyGenDescriptors = [...subgroup.disallowedBodyGenDescriptors, ...permutation.disallowedBodyGenDescriptors];


        if (subgroup.emptyFlagAR === true && permutation.emptyFlagAR === true)
        {
            permutation.emptyFlagAR = true;
        }
        else
        {
            permutation.emptyFlagAR = false;
        }      
        
        if (subgroup.emptyFlagAB === true && permutation.emptyFlagAB === true)
        {
            permutation.emptyFlagAB = true;
        }
        else
        {
            permutation.emptyFlagAB = false;
        }   
    }

    static convertAttributePairsToObjects(attributePairs, sourceSubgroup)
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
    }
};

function logPermutationBuildup (permutations, packName)
{
    if (packName !== undefined)
    {
        permutationBuildupLogString += "Permutations from: " + packName + "\n\n";
    }

    if (permutations != undefined)
    {
        permutationBuildupLogString += "Adding top-level subgroup " + permutations[0].subgroups[0].containedSubgroupIDs[0] + ":\n\n";
        for (let i = 0; i < permutations.length; i++)
        {
            for (let j = 0; j < permutations[i].contributingBottomLevelSubgroupIDs.length; j++)
            {
                permutationBuildupLogString += permutations[i].contributingBottomLevelSubgroupIDs[j];
                if (j < permutations[i].contributingBottomLevelSubgroupIDs.length - 1)
                {
                    permutationBuildupLogString += ",";
                }
            }
            permutationBuildupLogString += "\n";
        }
        permutationBuildupLogString += "\nCumulative permutation count: " + permutations.length + "\n\n";
    }

    return permutationBuildupLogString;
};

function savePermutationBuildupLog (packName, modulePath, fh)
{
    let permutationBuildupLogPath = modulePath + "\\Logs\\Permutation Buildup Logs\\" + packName + "_" + Aux.generateDateString() + ".txt";
    
    try
    {
        fh.saveTextFile(permutationBuildupLogPath, permutationBuildupLogString);
        alert("Wrote permutation buildup log file at " + permutationBuildupLogPath);
    } catch (e)
    {
        alert("Error: could not write permutation buildup log file at " + permutationBuildupLogPath);
    }
}

// COMPATIBILIZATION CODE
function compatibilizeDistributionEnabled(mutate1, mutate2)
{
    if (mutate1.distributionEnabled === false || mutate2.distributionEnabled === false)
    {
        mutate1.distributionEnabled = false;
    }
}

function compatibilizeAllowUnique(mutate1, mutate2)
{
    if (mutate1.allowUnique === false || mutate2.allowUnique === false)
    {
        mutate1.allowUnique = false;
    }
}

function compatibilizeAllowNonUnique(mutate1, mutate2)
{
    if (mutate1.allowNonUnique === false || mutate2.allowNonUnique === false)
    {
        mutate1.allowNonUnique = false;
    }
}

function bCompatibilizeAllowedRaces(mutate, doNotMutate, bRemoveDuplicates)
{
    // These checks should not be necessary but leaving in place currently
    if (mutate.allowedRaces.length === 0 && mutate.emptyFlagAR === false)
    {
        return false;
    }
    else if (doNotMutate.allowedRaces.length === 0 && doNotMutate.emptyFlagAR === false)
    {
        return false;
    }
    // END

    // if both allowedRaces lists are empty, simply return true
    else if (mutate.emptyFlagAR === true && doNotMutate.emptyFlagAR === true)
    {
        return true;
    }
    // if mutate has allowedRaces and doNotMutate doesn't, simply return true
    else if (mutate.emptyFlagAR === false && doNotMutate.emptyFlagAR === true)
    {
        return true;
    }
    // if mutate has no allowedRaces but doNotMutate does, copy its allowedRaces into mutate and disable the empty flag
    else if (mutate.emptyFlagAR === true && doNotMutate.emptyFlagAR === false)
    {
        mutate.allowedRaces = doNotMutate.allowedRaces.slice(); // shallow copy
        pruneSubgroupDisallowedRacesFromAllowed(mutate); // BUGFIX in version 1.9
        if (mutate.allowedRaces.length === 0) // if mutate's disallowed races fully conflict with doNotMutate's allowed races
        {
            return false;
        }
        mutate.emptyFlagAR = false;
    }
    // if both mutate and doNotMutate have allowedRaces
    else
    {     
        Aux.getArrayIntersectionWithTarget(mutate.allowedRaces, doNotMutate.allowedRaces)
        // if mutate no longer does after computing intersection with doNotMutate, then the two are invalid together
        if (mutate.allowedRaces.length === 0)
        {
            return false;
        }     
    }
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.allowedRaces, doNotMutate.allowedRaces); }
    return true;
}

function bCompatibilizeDisallowedRaces(mutate, doNotMutate, bRemoveDuplicates)
{
    // If any from parent are missing in current, add them to current
    Aux.addMissingArrayElements(doNotMutate.disallowedRaces, mutate.disallowedRaces);

    // If any disallowedRaces are present in AllowedRaces, remove them
    for (let i = 0; i < mutate.allowedRaces.length; i++)
    {
        if (doNotMutate.disallowedRaces.includes(mutate.allowedRaces[i]))
        {
            mutate.allowedRaces.splice(i, 1);
            i--;
        }
    }
    // if current subgroup previously had allowedRaces but no longer does after comparison with parent's disallowed races, they are incompatible
    if (mutate.allowedRaces.length === 0 && mutate.emptyFlagAR === false)
    {
        return false;
    }

    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.disallowedRaces, doNotMutate.disallowedRaces);}
    

    return true;
}

function compatibilizeAllowedAttributes(mutate, doNotMutate, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.allowedAttributes, doNotMutate.allowedAttributes)};
}

function compatibilizeDisallowedAttributes(mutate, doNotMutate, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.disallowedAttributes, doNotMutate.disallowedAttributes)};
}

function compatibilizeForceIfAttributes(mutate, doNotMutate, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.forceIfAttributes, doNotMutate.forceIfAttributes)};
}

function compatibilizeWeightRange(mutate, doNotMutate)
{
    // if field is filled for parent, inherit it in child
    for (let i = 0; i < 2; i++)
    {    
        if (Aux.isValidNumber(mutate.weightRange[i]) === false && Aux.isValidNumber(doNotMutate.weightRange[i]))
        {
            mutate.weightRange[i] = doNotMutate.weightRange[i];
        }
    }

    if (Aux.isValidNumber(mutate.weightRange[0]) && Aux.isValidNumber(doNotMutate.weightRange[0]))
    {
        mutate.weightRange[0] = Math.max(mutate.weightRange[0], doNotMutate.weightRange[0]);
    }

    if (Aux.isValidNumber(mutate.weightRange[1]) && Aux.isValidNumber(doNotMutate.weightRange[1]))
    {
        mutate.weightRange[1] = Math.min(mutate.weightRange[1], doNotMutate.weightRange[1]);
    }
}

function bCompatibilizeRequiredSubgroups(mutate1, mutate2, subgroupHierarchy)
{
    let bLiteralMatch = false;
    let currentTarget1;
    let currentTarget2;
    let currentSubgroup1;
    let currentSubgroup2;
    let replacementList1 = {};
    let replacementList2 = {};

    // check for mutual child subgroups
    
    // this section of code winnows down hierarchical required subgroups - e.g. if A[0] required HD.var1 and B[0] requires HD.var1.A, the compatibilized requiredSubgroups should specifically be HD.var1.A
    for (let key in mutate1.requiredSubgroups) // this loop only needs to iterate through mutate1 because if a key is not in mutate1 then it cannot be shared between both subgroups and therefore cannot be a mutual child subgroup
    {
        bLiteralMatch = false;
        replacementList1 = {};
        replacementList2 = {};
        for (let i = 0; i < mutate1.requiredSubgroups[key].length; i++)
        {
            if (parseInt(key) < 0)
            {
                let report = "";
                for (let j = 0; j < mutate1.requiredSubgroups[key].length; j++)
                {
                    report += mutate1.requiredSubgroups[key];
                    if (j < mutate1.requiredSubgroups[key].length - 1)
                    {
                        report += ",";
                    }
                }
                throw new Error("Error: subgroups " + report + " do not exist. Please use the validate button in the Settings Menu to track down the issue.");
            }
            
            currentTarget1 = mutate1.requiredSubgroups[key][i];
            if (mutate2.requiredSubgroups[key] !== undefined)
            {
                for (let j = 0; j < mutate2.requiredSubgroups[key].length; j++)
                {
                    currentTarget2 = mutate2.requiredSubgroups[key][j];
                    if (currentTarget1 !== currentTarget2)
                    {
                        // check if currentTarget2 contains currentTarget1
                        currentSubgroup2 = Aux.getSubgroupByName(subgroupHierarchy[key], currentTarget2);
                        if (Aux.bSubgroupHasChildSubgroup(currentSubgroup2, currentTarget1) === true)
                        {
                            replacementList2[j] = currentTarget1;
                        }

                        // check if currentTarget1 contains currentTarget2
                        currentSubgroup1 = Aux.getSubgroupByName(subgroupHierarchy[key], currentTarget1);
                        if (Aux.bSubgroupHasChildSubgroup(currentSubgroup1, currentTarget2) === true)
                        {
                            replacementList1[i] = currentTarget2;
                        }
                    }
                }
            }
        }

        for (let index in replacementList1)
        {
            mutate1.requiredSubgroups[key][index] = replacementList1[index];
        }

        for (let index in replacementList2)
        {
            mutate2.requiredSubgroups[key][index] = replacementList2[index];
        }
    }
    // end hierarchy check

    // remove non-mutual requiredSubgroups
    // this section of code checks for cross-compatiblitiy. Ex if A[0] = [var1, var2] and B[0] = [var2, var3], the compatibilized requirement array should be [var2].
    if (bCompatibilizeRequiredSubgroupIntersection(mutate1, mutate2) === false)  { return false; } // checks only subgroup (removeDuplicates = false to avoid screwing up the reverse check on the following line)
    if (bCompatibilizeRequiredSubgroupIntersection(mutate2, mutate1) === false)  { return false; } // checks only permutation | CHANGED TO FALSE IN 1.9
   
    return true;
}

function bCompatibilizeRequiredSubgroupIntersection(mutate, doNotMutate)
{
    // check for mutually exclusive subgroups here, a la allowedRaces  
    for (let key in mutate.requiredSubgroups)
    {
        if (doNotMutate.excludedSubgroups.includes(mutate.requiredSubgroups[key]))
        {
            return false;
        }
        if (doNotMutate.requiredSubgroups[key] !== undefined)
        {
            // if a subgroup is the requiredSubgroup 

            Aux.getArrayIntersectionWithTarget(mutate.requiredSubgroups[key], doNotMutate.requiredSubgroups[key]);

            if (mutate.requiredSubgroups[key].length === 0) // if there are no more requiredSubgroups at this position after computing the intersection, the two subgroups or subgroup/permutations are not compatible
            {
                return false;
            }
        }
    }

    return true;
}

function bCompatibilizeExcludedSubgroups(mutate, doNotMutate)
{
    for (let i =0; i < mutate.requiredSubgroups.length; i++)
    {
        if (doNotMutate.excludedSubgroups.includes(mutate.requiredSubgroups[i]))
        {
            return false;
        }
    }

    return true;
}

function compatibilizePaths(mutate1, mutate2, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate1.paths, mutate2.paths)};
}

function bCompatibilizeAllowedBodyGen(mutate1, mutate2, bRemoveDuplicates)
{
    for (let category in mutate1.allowedBodyGenDescriptors)
    {
        // check if mutate2 also has values in this category
        if (mutate2.allowedBodyGenDescriptors[category] !== undefined)
        {
            Aux.getArrayIntersectionWithTarget(mutate1.allowedBodyGenDescriptors[category], mutate2.allowedBodyGenDescriptors[category]);
            Aux.getArrayIntersectionWithTarget(mutate2.allowedBodyGenDescriptors[category], mutate1.allowedBodyGenDescriptors[category]);

            if (mutate1.allowedBodyGenDescriptors[category].length === 0)
            {
                return false; // if there are no allowedBodyGenDescriptors in the given category, it means they were removed by getArrayIntersectionWithTarget.
            }

            if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate1.allowedBodyGenDescriptors[category], mutate2.allowedBodyGenDescriptors[category]); }
        }
    }
    return true;
}

function bCompatibilizeDisallowedBodyGen(mutate, doNotMutate, bRemoveDuplicates)
{
    
    // If any from parent are missing in current, add them to current
    Aux.addMissingArrayElements(doNotMutate.disallowedBodyGenDescriptors, mutate.disallowedBodyGenDescriptors);

    // If any disallowedBodyGenDescriptors (from mutate or doNotMutate) are present in allowedBodyGenDescriptors, remove them
    if (pruneDisallowedBodyGenFromAllowed(mutate.allowedBodyGenDescriptors, mutate.disallowedBodyGenDescriptors) === false)
    {
        return false;
    }

    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicatesByValue(mutate.disallowedBodyGenDescriptors, doNotMutate.disallowedBodyGenDescriptors);}
    
    return true;
}

function pruneDisallowedBodyGenFromAllowed(allowedBodyGenDescriptors, exclusions)
{
    for (let category in allowedBodyGenDescriptors)
    {
        for (let i = 0; i < exclusions.length; i++)
        {
            if (category === exclusions[i].category)
            {
                for (let j = 0; j < allowedBodyGenDescriptors[category].length; j++)
                {
                    if (allowedBodyGenDescriptors[category][j] === exclusions[i].value)
                    {
                        allowedBodyGenDescriptors[category].splice(j, 1);
                        j--;
                    }
                }
            }
        }

        if (allowedBodyGenDescriptors[category].length === 0)
        {
            // implies that all AllowedPresets were stripped by the exclusions
            return false;
        }
    }

    return true;
}

// new in 1.9
function pruneSubgroupDisallowedRacesFromAllowed(subgroup)
{
    for (let i = 0; i < subgroup.allowedRaces.length; i++)
    {
        if (subgroup.disallowedRaces.includes(subgroup.allowedRaces[i]))
        {
            subgroup.allowedRaces.splice(i, 1);
            i--;
        }
    }
}