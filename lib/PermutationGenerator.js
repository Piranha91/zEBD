let Aux = require('./Auxilliary');

module.exports = function(logDir, fh)
    {
        let PG = {};
        PG.generateAssetPackPermutations = function (assetPackSettings, raceGroupDefinitions, patcherSettings, trimPaths, helpers)
        {
            let IO = require('./IO.js')(logDir, fh);

            let allPermutations = []; // array of PermutationHolders to return
            let variants = []; // array of bottom-level variants corresponding to top-level subgroup positions
            let currentSubgroupVariant = [];
            let currentPermutations = [];

            // get the subgroups at the bottom of each subgroup stack (e.g all possible branches of the subgroup tree). Copy the paths and restrictions from non-terminal nodes into the terminal ones (because otherwise they're not returned).
            for (let i = 0; i < assetPackSettings.length; i++)
            {
                helpers.logMessage("Generating permutations from " + assetPackSettings[i].groupName);
                variants = [];
                if (patcherSettings.bVerboseMode === true) { IO.logVerbose("Getting bottom-node subgroups in Pack Settings: " + assetPackSettings[i].groupName); }
                if (patcherSettings.permutationBuildUpLogger === true) { IO.logPermutationBuildup(undefined, false, assetPackSettings[i].groupName); }
                for (let j = 0; j < assetPackSettings[i].subgroups.length; j++) // generate every possible variant of each top-level subgroup. Each subgroup must be a unique object rather than a shared reference address.
                {
                    generateSubgroupVariants(assetPackSettings[i].subgroups[j], currentSubgroupVariant, new transferSubgroupInfo(), raceGroupDefinitions, patcherSettings.bVerboseMode, IO.logVerbose, assetPackSettings[i].subgroups, patcherSettings.bEnableBodyGenIntegration);
                    variants.push(currentSubgroupVariant);
                    currentSubgroupVariant = [];
                }

                // now variants is an array containing n sub-arrays. n = number of top-level subgroups (to be combined together); each array contains all sub-members of these top-level subgroups, to which parent subgroup data (if any) has been forwarded.
                // now generate a single array that contains all possible combinations of the n sub-arrays.

                if (patcherSettings.logVerbose === true) { IO.logVerbose( "\n" + assetPackSettings[i].groupName + ": generated permutation arrays for " + variants.length + " top-level subgroups\n"); }

                currentPermutations = generatePermutations(variants, raceGroupDefinitions, patcherSettings.bVerboseMode, IO.logVerbose, patcherSettings.permutationBuildUpLogger, IO.logPermutationBuildup, assetPackSettings[i].subgroups, helpers.logMessage, patcherSettings.bEnableBodyGenIntegration);
                finalizePermutations(currentPermutations, assetPackSettings[i].groupName, assetPackSettings[i].gender);
                Aux.copyArrayInto(currentPermutations, allPermutations);
            }

            allPermutations = trimPermutationPaths(allPermutations, trimPaths, fh);

            if (allPermutations.length === 0)
            {
                throw new Error("No permutations were generated. Either you ran the patcher without installing any config files or all of your config files have errors.")
            }

            if (patcherSettings.permutationBuildUpLogger === true) { IO.logPermutationBuildup(undefined, true); }

            return allPermutations;
        }

        PG.getPermutationsByGender = function(gender, permutations)
        {
            let outputs = [];
            for (let i = 0; i < permutations.length; i++)
            {
                if (permutations[i].gender.toLowerCase() === gender.toLowerCase())
                {
                    outputs.push(permutations[i]);
                }
            }
            return outputs;
        };

        PG.permutationByRaceGender = function (permutations, patchableGenders, patchableRaces)
        {
            let outputList = [];
            let PD = new permutationDict();
            let matchedRace = false;
            let matchedGender = false;

            for (let i = 0; i < patchableRaces.length; i++)
            {
                for (let j = 0; j < patchableGenders.length; j++)
                {
                    PD = new permutationDict();
                    PD.race = patchableRaces[i];
                    PD.gender = patchableGenders[j];

                    for (let k = 0; k < permutations.length; k++)
                    {
                        matchedRace = false;
                        matchedGender = false;
                        if (((permutations[k].allowedRaces.length === 0 && permutations[k].emptyFlagAR === true) || permutations[k].allowedRaces.includes(PD.race)) && permutations[k].disallowedRaces.includes(PD.race) === false)
                        {
                            matchedRace = true;
                        }
                        if (permutations[k].gender === PD.gender)
                        {
                            matchedGender = true;
                        }

                        if (matchedRace === true && matchedGender === true)
                        {
                            PD.permutations.push(permutations[k]);
                        }
                    }

                    outputList.push(PD);
                }
            }

            return outputList;
        };

        return PG;
    };

    // not for export
class permutationDict
{
    constructor()
    {
        this.race = "";
        this.gender = "";
        this.permutations = [];
    }
}

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

        permutation.allowedAttributes = [...this.convertAttributePairsToObjects(subgroup.allowedAttributes, subgroup), ...permutation.allowedAttributes];
        permutation.disallowedAttributes = [...this.convertAttributePairsToObjects(subgroup.disallowedAttributes, subgroup), ...permutation.disallowedAttributes];
        permutation.forceIfAttributes = [...this.convertAttributePairsToObjects(subgroup.forceIfAttributes, subgroup), ...permutation.forceIfAttributes];
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
    
    static copyComponents(copyFrom, copyTo)
    {
        Aux.copyArrayInto(copyFrom.paths, copyTo.paths);
        Aux.copyArrayInto(copyFrom.allowedRaces, copyTo.allowedRaces);        
        Aux.copyArrayInto(copyFrom.disallowedRaces, copyTo.disallowedRaces);        
        Aux.copyArrayInto(copyFrom.allowedAttributes, copyTo.allowedAttributes);       
        Aux.copyArrayInto(copyFrom.disallowedAttributes, copyTo.disallowedAttributes);       
        Aux.copyArrayInto(copyFrom.forceIfAttributes, copyTo.forceIfAttributes);        
        Aux.copyObjectArrayInto(copyFrom.requiredSubgroups, copyTo.requiredSubgroups);       
        Aux.copyArrayInto(copyFrom.excludedSubgroups, copyTo.excludedSubgroups);       
        Aux.copyArrayInto(copyFrom.containedSubgroupIDs, copyTo.containedSubgroupIDs);       
        Aux.copyArrayInto(copyFrom.containedSubgroupNames, copyTo.containedSubgroupNames);       
        Aux.copyArrayInto(copyFrom.addKeywords, copyTo.addKeywords);
        Aux.copyObjectArrayInto(copyFrom.allowedBodyGenDescriptors, copyTo.allowedBodyGenDescriptors);
        Aux.copyArrayInto(copyFrom.disallowedBodyGenDescriptors, copyTo.disallowedBodyGenDescriptors);

        Aux.getArrayUniques(copyTo.allowedRaces);
        Aux.getArrayUniques(copyTo.disallowedRaces);
        Aux.getArrayUniques(copyTo.disallowedBodyGenDescriptors);
    }
}

function generateSubgroupVariants(subgroup, permArray, parentSubgroup, restrictionGroupDefs, bVerboseMode, verboseLogger, subgroupHierarchy, bEnableBodyGenIntegration)
{
    let split = [];
    let category = "";
    let value = "";

    if (bVerboseMode === true)
    {
        let tmpLog = "\nLoaded subgroup: " + subgroup.id + " ";
        if (parentSubgroup === undefined || parentSubgroup.id === undefined || parentSubgroup.id === "")
        {
            tmpLog += "(top level subgroup)";
        }
        else
        {
            tmpLog += "(parent subgroup: " + parentSubgroup.id + ")";
        }
        verboseLogger(tmpLog);
    }
    // if the subgroup is disabled, return (neither this subgroup nor downstream branches will be loaded into permArray
    if (subgroup.enabled === false)
    {
        if (bVerboseMode === true) { verboseLogger("Subgroup is disabled. Terminating this branch of subgroup tree."); }
        return;
    }
    // copy any existing restrictions and paths in the parent transferSubgroupInfo object from previous recursion into a new variable (to avoid modifying the array for recursions that don't go down this branch)
    let pSGclone = angular.copy(parentSubgroup);
    // deep clone the subgroup to avoid making changes to it. Directly editing subgroup result in changes that are carried back to the user's settings JSON file (effectively piling all of the upper-level paths and restrictions into the lowest level nodes)
    let sgClone = angular.copy(subgroup);

    if (sgClone.allowedRaces.length === 0)
    {
        sgClone.emptyFlagAR = true; // this is necessary because sgClone is NOT a transferSubgroupInfo but an object loaded from the settings json file which does NOT have an emptyFlagAR attribute.
        if (bVerboseMode === true) { verboseLogger("This subgroup has no AllowedRaces entries.")}
    }
    else 
    { 
        sgClone.emptyFlagAR = false;
        sgClone.allowedRaces = Aux.replaceGroupDefWithIndividuals(sgClone.allowedRaces, restrictionGroupDefs);
    }

    if (sgClone.disallowedRaces.length === 0)
    {
        if (bVerboseMode === true) { verboseLogger("This subgroup has no DisallowedRaces entries.")}
    }
    else { 
        sgClone.disallowedRaces = Aux.replaceGroupDefWithIndividuals(sgClone.disallowedRaces, restrictionGroupDefs); 
    }

    // convert requiredSubgroups into an object for easier processing
    if (sgClone.requiredSubgroups.length > 0) // convert the requiredSubgroups array[string] into an array[string, int], where array[0] is the required subgroupID (the original requiredSubgroups[i]) and array[1] is the index of the top-level subgroup within which that subgroup is found
    {
        let reqTemp = {};
        let rSindex = -1;
        for (let i = 0; i < sgClone.requiredSubgroups.length; i++)
        {
            rSindex = getSubgroupIndexInPermutation(sgClone.requiredSubgroups[i], subgroupHierarchy);
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
    let conflictsResolved = bResolveSubgroupParentConflicts(sgClone, pSGclone, subgroupHierarchy, bVerboseMode, verboseLogger, bEnableBodyGenIntegration); // note that this function will modify both sgClone and transferSubGroupInfo to trim restrictions that are incompatible with upstream/downstream ones.
    // if irreconcilable conflict, return without adding this subgroup to the output array (permArray)
    if (conflictsResolved === false) { return;}
    // Otherwise, copy paths and restrictions from upper level recursions into the sgClone to be returned

    sgClone.probabilityWeighting *= pSGclone.probabilityWeighting; // multiply the probability weighting of the parent and current subgroup
    sgClone.containedSubgroupIDs = []; // For collecting traversed subgroupIDs (otherwise only the end node IDs are returned)
    sgClone.containedSubgroupNames = []; // for collecting names of traversed subgroups
    sgClone.parentSubgroups = [];

    transferSubgroupInfo.copyComponents(pSGclone, sgClone); // Now that conflicts between current subgroup and parent have been resolved, copy parent subgroup info into current subgroup info.
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
            generateSubgroupVariants(subgroup.subgroups[i], permArray, sgClone, restrictionGroupDefs, bVerboseMode, verboseLogger, subgroupHierarchy, bEnableBodyGenIntegration);
        }
    }
}

// this function generates all possible combinations of the permutations derived from top-level subgroups
// combinations are checked for internal subgroup compatibility as they are being built, and discarded if internal subgroups are mutually exclusive
function generatePermutations(variants, restrictionGroupDefs, bVerboseMode, verboseLogger, permutationBuildUpLogger, logPermutationBuildup, subgroupHierarchy, logMessage, bEnableBodyGenIntegration)
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
        logMessage("Added subgroup(s) " + variants[0][0].containedSubgroupIDs[0] + " to permutations (" + combinationsFromThisLayer.length.toString() + " permutations created)");
        if (permutationBuildUpLogger === true)
        {
            logPermutationBuildup(combinationsFromThisLayer, false);
        }
        return combinationsFromThisLayer;
    } 

    // otherwise, split the current array into the first column and all other columns
    let firstColumn = variants[0];

    // iterate through the first column ([head1, head2])

    // create a subArray of all other columns
    let otherColumns = variants.slice(1); // slice function without a second parameter returns subarray from 1 to the end of the array).

    let subPermutations = generatePermutations(otherColumns, restrictionGroupDefs, bVerboseMode, verboseLogger, permutationBuildUpLogger, logPermutationBuildup, subgroupHierarchy, logMessage, bEnableBodyGenIntegration); // recursively call this function to generate all permutation combinations from the columns to the right of this one.

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
            if (checkPermutationRequireAllowExclude(firstColumn[i], subPermutations[j], subgroupHierarchy, currentSubgroupPos) === true) // this is a separate function from bResolveSubgroupPermutationConflicts() to avoid wasting time on unnecessary angular.copy() calls
            {
                subGroupA = angular.copy(firstColumn[i]); // make copy to avoid mutating original object for other permutations
                permutationB = angular.copy(subPermutations[j]);     // make copy to avoid mutating original object for other permutations

                // handle compatibility between subgroupA and permutationB (allowedRaces, ExcludedRaces, etc), making edits if necessary
                if (bResolveSubgroupPermutationConflicts(subGroupA, permutationB, subgroupHierarchy, bVerboseMode, verboseLogger, bEnableBodyGenIntegration) === true)
                {                 
                    permutationHolder.appendSubgroupToPH(subGroupA, permutationB);
                    combinationsFromThisLayer.push(permutationB);
                }
            }   
        }   
    }

    if (permutationBuildUpLogger === true)
    {
        logPermutationBuildup(combinationsFromThisLayer, false);
    }

    if (firstColumn[0] !== undefined)
    {
        logMessage("Added subgroup(s) " + firstColumn[0].containedSubgroupIDs[0] + " to permutations (" + combinationsFromThisLayer.length.toString() + " permutations created cumulatively)");
    }
    
    if (combinationsFromThisLayer.length > 200000)
    {
        logMessage("Generated over 200,000 variants. Please use the \"requiredSubgroups\" \"excludedSubgroups\" feature to cut down on the number of possible permutations to avoid memory overflow.");
        
        return [];
    }

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

function getSubgroupIndexInPermutation(subgroupID, subgroupHierarchy)
{
    for (let i =0; i < subgroupHierarchy.length; i++)
    {
        if (bSubgroupInCurrentSubgroup(subgroupHierarchy[i], subgroupID) === true)
        {
            return i;
        }
    }
    return -1;
}

function bSubgroupInCurrentSubgroup(currentSubgroup, id)
{
    let bFound = false;

    if (currentSubgroup.id === id) { return true }
    else if (currentSubgroup.subgroups.length > 0)
    {
        for (let i = 0; i < currentSubgroup.subgroups.length; i++)
        {
            bFound = bSubgroupInCurrentSubgroup(currentSubgroup.subgroups[i], id)
            if (bFound === true) { return true; }
        }
    }
    return false;
}

function getIndexInFinalArray(index, currentLength, maxLength)
{
    return maxLength - currentLength + index;
}

function finalizePermutations(permutations, sourceAssetPack, gender)
{
    for (let i = 0; i < permutations.length; i++)
    {
        permutations[i].sourceAssetPack = sourceAssetPack;
        permutations[i].gender = gender;
    }
}

// this function removes the folder name from an asset path according to its extension
// if the assetPatckSettings specifies that a texture is in Textures\A\B.dds, this function converts it to A\B.dds
function trimPermutationPaths(permutations, trimPaths, fh)
{
    let currentExtension = "";
    let trimPathExtension = "";
    let pathLC = "";
    let toReplace = "";

    for (let i = 0; i < permutations.length; i++)
    {
        for (let j = 0; j < permutations[i].paths.length; j++)
        {
            currentExtension = fh.getFileExt(permutations[i].paths[j][0].toLowerCase());
            for (let k = 0; k < trimPaths.length; k++)
            {
                trimPathExtension = trimPaths[k].extension.toLowerCase();
                if (currentExtension === trimPathExtension)
                {
                    pathLC = permutations[i].paths[j][0].toLowerCase();
                    toReplace = trimPaths[k].pathToTrim.toLowerCase() + "\\";
                    pathLC = pathLC.replace(toReplace, ""); // string.replace is safe because it only replaces the first instance of toReplace
                    permutations[i].paths[j][0] = pathLC;
                    break;
                }
            }
        }
    }

    return permutations;
}


// this function checks a subgroup object for conflicts with its parent subgroups
// If possible, the subgroup is edited to maintain compatibility with parent subgroups.
// If the subgroup restrictions render it incompatible with its parent subgroups, returns false
// Only subgroup should be edited; parent is not carried forward anyway.
function bResolveSubgroupParentConflicts(subgroup, parent, subgroupHierarchy, bVerboseMode, verboseLogger, bEnableBodyGenIntegration)
{
    if (bVerboseMode === true) { verboseLogger("Checking subgroup "+ subgroup.id + " for compatibility with " + parent.id); }

    compatibilizeDistributionEnabled(subgroup, parent);
    compatibilizeAllowUnique(subgroup, parent);
    compatibilizeAllowNonUnique(subgroup, parent);
    
    if (bCompatibilizeAllowedRaces(subgroup, parent, bVerboseMode, verboseLogger, false) === false) { return false; } // duplicates handled in copy function to avoid logic errors
    if (bCompatibilizeDisallowedRaces(subgroup, parent, bVerboseMode, verboseLogger, false) === false) { return false; } // duplicates handled in copy function to avoid logic errors
    compatibilizeAllowedAttributes(subgroup, parent, bVerboseMode, verboseLogger, true);
    compatibilizeDisallowedAttributes(subgroup, parent, bVerboseMode, verboseLogger, true);
    compatibilizeForceIfAttributes(subgroup, parent, bVerboseMode, verboseLogger, true);
    compatibilizeWeightRange(subgroup, parent, bVerboseMode, verboseLogger);    
    
    if (bCompatibilizeRequiredSubgroups(subgroup, parent, subgroupHierarchy, bVerboseMode, verboseLogger) === false) { return false; } 
    
    if (bCompatibilizeExcludedSubgroups(subgroup, parent, bVerboseMode, verboseLogger, false) === false)  { return false; } //removeDuplicates = false to avoid screwing up the reverse check on the following line
    if (bCompatibilizeExcludedSubgroups(parent, subgroup, bVerboseMode, verboseLogger, true) === false)  { return false; } 
    compatibilizePaths(subgroup, parent, true);

    if (bEnableBodyGenIntegration === true)
    {
        if (bCompatibilizeAllowedBodyGen(subgroup, parent, bVerboseMode, verboseLogger, true) === false) { return false; } 
        if (bCompatibilizeDisallowedBodyGen(subgroup, parent, bVerboseMode, verboseLogger, true) === false) { return false; }
    }

    return true;
}

function bResolveSubgroupPermutationConflicts(subgroup, permutation, subgroupHierarchy, bVerboseMode, verboseLogger, bEnableBodyGenIntegration)
{
    // bRemoveDuplicates must be set to false to handle the allowed/disallowed Races compatibilization. Otherwise the logic fails.
    if (bCompatibilizeAllowedRaces(subgroup, permutation, bVerboseMode, verboseLogger, false) === false) { return false; } // trims only subgroup
    if (bCompatibilizeAllowedRaces(permutation, subgroup, bVerboseMode, verboseLogger, false) === false) { return false; } // trims only permutation     
    if (bCompatibilizeDisallowedRaces(subgroup, permutation, bVerboseMode, verboseLogger, false) === false) { return false; } // checks only subgroup
    if (bCompatibilizeDisallowedRaces(permutation, subgroup, bVerboseMode, verboseLogger, false) === false) { return false; } // checks only permutation
    //allowed/disallowedRaces are trimmed back to their unique constitituents when subgroup is added to permutation in permutationHolder.appendSubgroupToPH
    compatibilizeAllowedAttributes(subgroup, permutation, bVerboseMode, verboseLogger, true); 
    compatibilizeDisallowedAttributes(subgroup, permutation, bVerboseMode, verboseLogger, true);
    compatibilizeForceIfAttributes(subgroup, permutation, bVerboseMode, verboseLogger, true);
    compatibilizeWeightRange(subgroup, permutation, bVerboseMode, verboseLogger);     
    
    if (bCompatibilizeRequiredSubgroups(subgroup, permutation, subgroupHierarchy, bVerboseMode, verboseLogger) === false) { return false; }
    
    if (bCompatibilizeExcludedSubgroups(subgroup, permutation, bVerboseMode, verboseLogger, false) === false)  { return false; } // checks only subgroup (removeDuplicates = false to avoid screwing up the reverse check on the following line)
    if (bCompatibilizeExcludedSubgroups(permutation, subgroup, bVerboseMode, verboseLogger, true) === false)  { return false; } // checks only permutation 
    compatibilizePaths(subgroup, permutation, true);

    if (bEnableBodyGenIntegration === true)
    {
        if (bCompatibilizeAllowedBodyGen(subgroup, permutation, bVerboseMode, verboseLogger, true) === false) { return false; } 
        if (bCompatibilizeDisallowedBodyGen(subgroup, permutation, bVerboseMode, verboseLogger, false) === false) { return false; } // checks only subgroup
        if (bCompatibilizeDisallowedBodyGen(permutation, subgroup, bVerboseMode, verboseLogger, true) === false) { return false; } // checks only permutation
    }

    return true;
}


function compatibilizeDistributionEnabled(mutate1, mutate2, bVerboseMode, verboseLogger)
{
    if (mutate1.distributionEnabled === false || mutate2.distributionEnabled === false)
    {
        mutate1.distributionEnabled = false;
        if (bVerboseMode === true) { verboseLogger("Distribution of this subgroup is disabled."); }
    }
}

function compatibilizeAllowUnique(mutate1, mutate2, bVerboseMode, verboseLogger)
{
    if (mutate1.allowUnique === false || mutate2.allowUnique === false)
    {
        mutate1.allowUnique = false;
        if (bVerboseMode === true) { verboseLogger("Distribution of this subgroup to unique NPCs is disabled."); }
    }
}

function compatibilizeAllowNonUnique(mutate1, mutate2, bVerboseMode, verboseLogger)
{
    if (mutate1.allowNonUnique === false || mutate2.allowNonUnique === false)
    {
        mutate1.allowNonUnique = false;
        if (bVerboseMode === true) { verboseLogger("Distribution of this subgroup to non-unique NPCs is disabled."); }
    }
}

function bCompatibilizeAllowedRaces(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
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
        mutate.emptyFlagAR = false;
    }
    // if both mutate and doNotMutate have allowedRaces
    else
    {     
        Aux.getArrayIntersectionWithTarget(mutate.allowedRaces, doNotMutate.allowedRaces, bVerboseMode, verboseLogger)
        // if mutate no longer does after computing intersection with doNotMutate, then the two are invalid together
        if (mutate.allowedRaces.length === 0)
        {
            return false;
        }     
    }
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.allowedRaces, doNotMutate.allowedRaces); }
    return true;
}

function bCompatibilizeDisallowedRaces(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
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

function compatibilizeAllowedAttributes(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.allowedAttributes, doNotMutate.allowedAttributes)};
}

function compatibilizeDisallowedAttributes(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.disallowedAttributes, doNotMutate.disallowedAttributes)};
}

function compatibilizeForceIfAttributes(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.forceIfAttributes, doNotMutate.forceIfAttributes)};
}

function compatibilizeWeightRange(mutate, doNotMutate, bVerboseMode, verboseLogger)
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

function bCompatibilizeRequiredSubgroups(mutate1, mutate2, subgroupHierarchy, bVerboseMode, verboseLogger)
{
    let bLiteralMatch = false;
    let currentTarget1;
    let currentTarget2;
    let currentSubgroup1;
    let currentSubgroup2;
    let replacementList1 = {};
    let replacementList2 = {};

    // check for mutual child subgroups
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

    // remove non-mutual requiredSubgroups
    if (bCompatibilizeRequiredSubgroupIntersection(mutate1, mutate2, bVerboseMode, verboseLogger, false) === false)  { return false; } // checks only subgroup (removeDuplicates = false to avoid screwing up the reverse check on the following line)
    if (bCompatibilizeRequiredSubgroupIntersection(mutate2, mutate1, bVerboseMode, verboseLogger, true) === false)  { return false; } // checks only permutation
   
    return true;
}

function bCompatibilizeRequiredSubgroupIntersection(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
{
    // check for mutually exclusive subgroups here, a la allowedRaces  
    for (let key in mutate.requiredSubgroups)
    {
        if (doNotMutate.excludedSubgroups.includes(mutate.requiredSubgroups[key]))
        {
            if (bVerboseMode === true) { verboseLogger("\nWARNING: ExcludedSubgroups from " + mutate.id + " contains RequiredSubgroups from " + doNotMutate.id + ". " + mutate.id + " and its child subgroups will be discarded.\n"); }
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

            if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.requiredSubgroups[key], doNotMutate.requiredSubgroups[key]); }
        }
    }

    return true;
}

function bCompatibilizeExcludedSubgroups(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
{
    for (let i =0; i < mutate.requiredSubgroups.length; i++)
    {
        if (doNotMutate.excludedSubgroups.includes(mutate.requiredSubgroups[i]))
        {
            if (bVerboseMode === true) { verboseLogger("\nWARNING: RequiredSubgroups from " + mutate.id + " contains ExcludedSubgroups from " + doNotMutate.id + ". " + mutate.id + " and its child subgroups will be discarded.\n"); }
            return false;
        }
    }

    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate.excludedSubgroups, doNotMutate.excludedSubgroups); }

    return true;
}

function compatibilizePaths(mutate1, mutate2, bRemoveDuplicates)
{
    if (bRemoveDuplicates === true) { Aux.removeArrayDuplicates(mutate1.paths, mutate2.paths)};
}

function bCompatibilizeAllowedBodyGen(mutate1, mutate2, bVerboseMode, verboseLogger, bRemoveDuplicates)
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

function bCompatibilizeDisallowedBodyGen(mutate, doNotMutate, bVerboseMode, verboseLogger, bRemoveDuplicates)
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