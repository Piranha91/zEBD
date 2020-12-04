let Aux = require('./Auxilliary');
let BGI = require('./BodyGenIntegration.js')(Aux);

module.exports = function()
{
    let PG = {};
    //let IO = require('./IO.js')(logDir, fh);

    PG.generateFlattenedAssetPackSettings = function(assetPackSettings, raceGroupDefinitions, patcherSettings)
    {
        let variants = []; // array of bottom-level variants corresponding to top-level subgroup positions
        let currentSubgroupVariant = [];
        for (let i = 0; i < assetPackSettings.length; i++)
        {
            variants = [];
            for (let j = 0; j < assetPackSettings[i].subgroups.length; j++) // generate every possible variant of each top-level subgroup. Each subgroup must be a unique object rather than a shared reference address.
            {
                generateSubgroupVariants(assetPackSettings[i].subgroups[j], currentSubgroupVariant, new transferSubgroupInfo(), raceGroupDefinitions, assetPackSettings[i].subgroups, patcherSettings.bEnableBodyGenIntegration);
                
                // tag subgroup with its parent asset pack name and its top-level index so it can be pulled from the pooled list
                for (let k = 0; k < currentSubgroupVariant.length; k++)
                {
                    currentSubgroupVariant[k].parentAssetPack = assetPackSettings[i].groupName;
                    currentSubgroupVariant[k].topLevelIndex = j;
                }
                //
                variants.push(currentSubgroupVariant);
                currentSubgroupVariant = [];
            }

            assetPackSettings[i].flattenedSubgroups = variants;
        }
    }

    PG.flattenedSubgroupsByRaceGender = function(assetPackSettings, patcherSettings)
    {
        let sortedAssets = {};
        let currentList = {};
        let tmpConfig = {};

        let invalidFlag = false;

        sortedAssets.male = {};
        sortedAssets.female = {};

        for (let i = 0; i < patcherSettings.patchableRaces.length; i++)
        {
            sortedAssets.male[patcherSettings.patchableRaces[i]] = [];
            sortedAssets.female[patcherSettings.patchableRaces[i]] = [];

            for (let j = 0; j < assetPackSettings.length; j++)
            {
                tmpConfig = angular.copy(assetPackSettings[j]);
                invalidFlag = false;
                
                switch(assetPackSettings[j].gender)
                {
                    case "male": 
                        currentList = sortedAssets.male[patcherSettings.patchableRaces[i]];
                        break;
                    case "female":
                        currentList = sortedAssets.female[patcherSettings.patchableRaces[i]];
                        break;
                }

                // get rid of subgroups that aren't valid for the current race
                for (let k = 0; k < tmpConfig.flattenedSubgroups.length; k++)
                {
                    for (let z = 0; z < tmpConfig.flattenedSubgroups[k].length; z++)
                    {
                        if (tmpConfig.flattenedSubgroups[k][z].allowedRaces.length > 0 && tmpConfig.flattenedSubgroups[k][z].allowedRaces.includes(patcherSettings.patchableRaces[i]) === false)
                        {
                            tmpConfig.flattenedSubgroups[k].splice(z, 1);
                            z--;
                        }
                    }

                    if (tmpConfig.flattenedSubgroups[k].length === 0)
                    {
                        invalidFlag = true;
                        break;
                    }
                }

                // if all top-level subgroups have at least one subgroup valid for the current race, add it to the object
                if (invalidFlag === false)
                {
                    currentList.push(tmpConfig);
                }
            }
        }

        return sortedAssets;
    }

    PG.initializePermAssignmentTracker = function(assetPacks)
    {
        let tracker = {};
        for (let i = 0; i < assetPacks.length; i++)
        {
            tracker[assetPacks[i].groupName] = 0;
        }

        return tracker;
    }
    
    PG.choosePermutationAndBodyGen = function(NPCrecordHandle, NPCinfo, permutations, assetPackSettings, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, consistencyRecords, userForcedAssignment, userBlockedAssignment, LinkedNPCNameExclusions, linkedNPCpermutations, linkedNPCbodygen, NPClinkGroup, permAssignmentTracker, attributeCache, logMessage, fh, modulePath, settings)
    { 
        let permutationToReturn = undefined;            // function output
        let assetPackSettings_Filtered = [];            // contains only those subgroups that are forced or allowed for the current NPC
        let bSkipSelection = false;                     // skip asset selection because the permutation has been pre-set by another NPC
        let verboseReport = [];
        let out_writeVerbose = {};
        
        // initialize verbose report
        out_writeVerbose.enableLogging = false;
        out_writeVerbose.reportThisNPC = false;
        out_writeVerbose.forceFullLogging = false;
        if (settings.bVerboseMode_Assets_Failed || settings.bVerboseMode_Assets_All || NPCinfo.bForceVerboseLogging)
        {
            out_writeVerbose.enableLogging = true;
        }
        if (settings.bVerboseMode_Assets_All || NPCinfo.bForceVerboseLogging)
        {
            out_writeVerbose.forceFullLogging = true;
        }

        Aux.logVerbose("======================================================================================\nReport for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ")\n", verboseReport, out_writeVerbose);

        // if NPC belongs to a link group and the permutation for the group has already been assigned, use the permutation from the link group
        if (NPClinkGroup !== undefined && NPClinkGroup.permutation !== undefined && permutationAllowedByUserForceList(userForcedAssignment, NPClinkGroup.permutation) === true)
        {
            permutationToReturn = NPClinkGroup.permutation;
            bSkipSelection = true;
            Aux.logVerbose("NPC has been found in a Link Group whose permutation has already been set. Using the Link Group permutation.", verboseReport, out_writeVerbose);
        }

        // if NPC assignments are linked by name, check if the current NPC has already been matched and use its permutation if so
        if (bSkipSelection === false && settings.bLinkNPCsWithSameName === true && NPCinfo.isUnique === true)
        {
            permutationToReturn = Aux.findInfoInlinkedNPCdata(NPCinfo, linkedNPCpermutations)
            if (permutationToReturn != undefined && permutationAllowedByUserForceList(userForcedAssignment, permutationToReturn) === true)
            {
                bSkipSelection = true;
                Aux.logVerbose("A permutation has been assigned to a unique NPC with the same name and race. Using this permutation.", verboseReport, out_writeVerbose);
            }
        }

        // alias NPC as needed
        Aux.setAliasRace(NPCinfo, settings.raceAliasesSorted, "assets");

        if (bSkipSelection === false)
        {
            assetPackSettings_Filtered = filterValidConfigsForNPC(NPCrecordHandle, NPCinfo, assetPackSettings, userForcedAssignment, NPCinfo, verboseReport, out_writeVerbose, xelib, logMessage, attributeCache) // filters by race, gender, allowed/disallowed attributes, and forced assignments
            permutationToReturn = chooseRandomPermutation(assetPackSettings_Filtered, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, settings.bEnableBodyGenIntegration, settings.bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, settings.bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, verboseReport, settings.raceAliasesSorted, out_writeVerbose, xelib, logMessage, attributeCache);
        }

        // write verbose report if necessary
        if (settings.bVerboseMode_Assets_Failed === true && out_writeVerbose.reportThisNPC === true)
        {
            fh.saveTextFile(modulePath + "\\Logs\\Failed Asset Assignments " + settings.initDateString + "\\" + NPCinfo.EDID + " (" + NPCinfo.formID + ").txt", verboseReport.join("\n"));
        }
        if (settings.bVerboseMode_Assets_All)
        {
            fh.saveTextFile(modulePath + "\\Logs\\All Asset Assignments " + settings.initDateString + "\\" + NPCinfo.EDID + " (" + NPCinfo.formID + ").txt", verboseReport.join("\n"));
        }
        if (NPCinfo.bForceVerboseLogging)
        {
            fh.saveTextFile(modulePath + "\\Logs\\Specific NPC Asset Assignments " + settings.initDateString + "\\" + NPCinfo.EDID + " (" + NPCinfo.formID + ").txt", verboseReport.join("\n"));
        }

        // Assign the chosen permutation to all relevant data lists
        if (permutationToReturn === undefined)
        {
            logMessage("\nAsset Assignment: no permutations satisfied criteria for " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). See zEBD\\Logs\\PermutationAssignmentFailures.txt for details.");
            //logMessage(Aux.formatFailureModeString(failureModes, "permutation"));
            permutationToReturn = undefined;          

            if (settings.bEnableConsistency === true)
            {
                updatePermutationConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], permutationToReturn); // clears out the consistency
            }

            Aux.revertAliasRace(NPCinfo);
            return undefined;
        }
        else 
        {
            permutationToReturn = linkPermutationToUniques(permutationToReturn, permutations);
            permutationToReturn.NPCsAssignedTo.push("[" + NPCinfo.name + "|" + NPCinfo.EDID + "|" + NPCinfo.formID + "]"); // store for the permutation log
            Aux.updatelinkedDataArray(settings.bLinkNPCsWithSameName, NPCinfo, permutationToReturn, LinkedNPCNameExclusions, linkedNPCpermutations) // store for linking same-named NPCs
            
            // store permutation for link group if it exists
            if (NPClinkGroup !== undefined && NPClinkGroup.permutation === undefined)
            {
                NPClinkGroup.permutation = permutationToReturn;
            }

            if (settings.bEnableConsistency === true)
            {
                if (NPCinfo.consistencyIndex === -1) // if no record of this NPC exists in the consistency file, create one
                {
                    Aux.createConsistencyRecord(NPCrecordHandle, NPCinfo, consistencyRecords, xelib) // NPCinfo.consistencyIndex gets updated here
                } 
                updatePermutationConsistencyRecord(consistencyRecords[NPCinfo.consistencyIndex], permutationToReturn);
            }
            
            permAssignmentTracker[permutationToReturn.sourceAssetPack]++;
        }

        Aux.revertAliasRace(NPCinfo);
        return permutationToReturn;
    };

    return PG;
};

// not for export
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
        this.emptyFlagAR = true; // tells the conflict checker function that this permutation has no allowedRaces due to user input rather than conflict pruning
        
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
        this.writtenRecords = [];
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
}

// functions to support subgroup variant generation

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

// this function checks a subgroup object for conflicts with its parent subgroups
// If possible, the subgroup is edited to maintain compatibility with parent subgroups.
// If the subgroup restrictions render it incompatible with its parent subgroups, returns false
// Only subgroup should be edited; parent is not carried forward anyway.
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

// main permutation generation functions
function filterValidConfigsForNPC(NPCrecordHandle, NPCinfo, assetPackSettings, userForcedAssignment, NPCinfo, verboseReport, out_writeVerbose, xelib, logMessage, attributeCache)
{
    let filtered = [];
    let tmp = {};
    let emptyFlag = false;
    let forcedAssetPack = "";
    let forcedSubgroups = {};
    let disallowedSubgroupReasons = [""];

    Aux.logVerbose("Original subgroups available to NPCs of gender " + NPCinfo.gender + " and race " + NPCinfo.race + ":\n" + Aux.formatAssetPacksForVerbose(assetPackSettings, false), verboseReport, out_writeVerbose);

    // populated forcedSubgroups object with the subgrgroups forced by user (now categorized by index)
    if (userForcedAssignment !== undefined && userForcedAssignment.forcedSubgroups !== undefined && userForcedAssignment.forcedSubgroups.length > 0)
    {
        forcedAssetPack = userForcedAssignment.forcedAssetPack;
        for (let i = 0; i < userForcedAssignment.forcedSubgroups.length; i++)
        {
            if (forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex] === undefined)
            {
                forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex] = [];
            }

            forcedSubgroups[userForcedAssignment.forcedSubgroups[i].topLevelIndex].push(userForcedAssignment.forcedSubgroups[i].id);
        }
    }

    // assemble filtered config files
    for (let i = 0; i < assetPackSettings.length; i++)
    {
        emptyFlag = false;

        tmp = {}; // tmp is an object resembling a config file json object
        tmp.groupName = assetPackSettings[i].groupName;
        tmp.gender = assetPackSettings[i].gender;
        tmp.subgroups = assetPackSettings[i].subgroups; // needed to compatibilize requiredSubgroups (serves as subgroupHierarchy)
        tmp.probabilityWeighting = assetPackSettings[i].probabilityWeighting;
        tmp.flattenedSubgroups = [];

        Aux.logVerbose("\nExamining subgroups from " + assetPackSettings[i].groupName + " for incompatibilities with current NPC.", verboseReport, out_writeVerbose);

        for (let j = 0; j < assetPackSettings[i].flattenedSubgroups.length; j++)
        {
            tmp.flattenedSubgroups.push([]);
            for (let k = 0; k < assetPackSettings[i].flattenedSubgroups[j].length; k++)
            {
                // if the current subgroup is either forced by user or valid for current NPC, keep it
                if ((assetPackSettings[i].groupName === forcedAssetPack && forcedSubgroups[j] !== undefined && bForcedArrayContainsSubgroup(forcedSubgroups[j], assetPackSettings[i].flattenedSubgroups[j][k]) === true) || bSubgroupValidForCurrentNPC(NPCrecordHandle, assetPackSettings[i].flattenedSubgroups[j][k], NPCinfo, disallowedSubgroupReasons, xelib, logMessage, attributeCache) === true)
                {
                    tmp.flattenedSubgroups[j].push(assetPackSettings[i].flattenedSubgroups[j][k]);
                }
                else
                {
                    Aux.logVerbose("Subgroup " + assetPackSettings[i].flattenedSubgroups[j][k].id + " was removed because " + disallowedSubgroupReasons[0], verboseReport, out_writeVerbose);
                }
            }

            // if any subgroup slot is empty, skip this asset pack
            if (tmp.flattenedSubgroups[j].length === 0)
            {
                if (userForcedAssignment !== undefined && userForcedAssignment.forcedAssetPack === tmp.groupName)
                {
                    logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "). The forced asset pack " + tmp.groupName + " could not be assigned because no subgroups within " + tmp.subgroups[j].id + " are valid for this NPC.");
                    Aux.logVerbose("The forced asset pack " + tmp.groupName + " could not be assigned because no subgroups within " + tmp.subgroups[j].id + " are valid for this NPC.", verboseReport, out_writeVerbose);
                }
                Aux.logVerbose("All subgroups from config file " + tmp.groupName + " will be discarded for the current NPC because no subgroups within " + tmp.subgroups[j].id + " are valid for this NPC.", verboseReport, out_writeVerbose);
                emptyFlag = true;
                break;
            }
        }

        if (emptyFlag === false)
        {
            filtered.push(tmp);
        }
    }

    return filtered;
}

function bSubgroupValidForCurrentNPC(NPCrecordHandle, subgroup, NPCinfo, disallowedSubgroupReasons, xelib, logMessage, attributeCache)
{
    let bAttributeMatched = false;
    let bSubgroupForced = false;
    let tmpFailureStr = "";
    let bMissingAllAllowedAttriubutes = false;
    let bForceIfMatched = false;

    // "Distribution enabled"
    if (subgroup.distributionEnabled === false)
    {
        disallowedSubgroupReasons[0] = ["Distribution disabled for non-user-forced NPCs"];
        return false;
    }

    // "Allow unique NPCs"
    if (subgroup.allowUnique === false && NPCinfo.isUnique === true)
    {
        disallowedSubgroupReasons[0] = ["Distribution disallowed for unique NPCs"];
        return false;
    }

    // "Allow non-unique NPCs"
    if (subgroup.allowNonUnique === false && NPCinfo.isUnique === false)
    {
        disallowedSubgroupReasons[0] = ["Distribution disallowed for non-unique NPCs"];
        return false;
    }

    // "weight range"
    if (Aux.isValidNumber(subgroup.weightRange[0]) && NPCinfo.weight < subgroup.weightRange[0])
    {
        disallowedSubgroupReasons[0] = ["NPC weight (" + NPCinfo.weight.toString() + ") <  " + subgroup.weightRange[0].toString()];
        return false;
    }
    if (Aux.isValidNumber(subgroup.weightRange[1]) && NPCinfo.weight > subgroup.weightRange[1])
    {
        disallowedSubgroupReasons[0] = ["NPC weight (" + NPCinfo.weight.toString() + ") >  " + subgroup.weightRange[1].toString()];
        return false;
    }

    // "Disallowed Attributes"
    for (let j = 0; j < subgroup.disallowedAttributes.length; j++) 
    {
        if (Aux.bAttributeMatched(subgroup.disallowedAttributes[j][0], subgroup.disallowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache)) // if current NPC matches current subgroup's disallowed attribute
        {
            // ignore if attribute is forced by user OR attribute is also a forceIf attribute
            if (bSubgroupForced === false)
            {
                disallowedSubgroupReasons[0] = ["NPC has disallowed attribute: (" + subgroup.disallowedAttributes[j][0] + ": " + subgroup.disallowedAttributes[j][1] + ")"];
                return false;
            }

        }
    }

    // if the current subgroup's forceIf attributes match the current NPC, skip the checks for allowed attributes
    for (let j = 0; j < subgroup.forceIfAttributes.length; j++)
    {
        if (Aux.bAttributeMatched(subgroup.forceIfAttributes[j][0], subgroup.forceIfAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache))
        {
            bForceIfMatched = true;
            break;
        }
    }
    
    if (bForceIfMatched === false)
    {
        // "Allowed Attributes"
        tmpFailureStr = "NPC lacks any of the following allowed attributes:\n";
        for (let j = 0; j < subgroup.allowedAttributes.length; j++) 
        {
            bAttributeMatched = Aux.bAttributeMatched(subgroup.allowedAttributes[j][0], subgroup.allowedAttributes[j][1], NPCrecordHandle, logMessage, xelib, attributeCache);
            if (bAttributeMatched === true)
            {
                break;
            }
            else
            {
                tmpFailureStr += " (" + subgroup.allowedAttributes[j][0] + ": " + subgroup.allowedAttributes[j][1] + ")\n"
            }
        }

        bMissingAllAllowedAttriubutes = (subgroup.allowedAttributes.length > 0 && bAttributeMatched === false);
        if (bMissingAllAllowedAttriubutes === true && bSubgroupForced === false) // if the NPC lacks at least one of this subgroup's allowed attributes AND the subgroup is not forced by either the user or a forceIF, disallow it
        {
            disallowedSubgroupReasons[0] = [tmpFailureStr];
            return false;
        }
    }

    return true;
}

function chooseRandomPermutation(assetPackSettings, assignedBodyGen, bodyGenConfig, BGcategorizedMorphs, bEnableBodyGenIntegration, bEnableConsistency, consistencyRecords, userForcedAssignment, userBlockedAssignment, NPCrecordHandle, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, NPCinfo, verboseReport, raceAliases, out_writeVerbose, xelib, logMessage, attributeCache)
{
    // vars for permutation generation

    let bValidChoice = false;
    let validPermutations_withoutConsistency = []; // cache of valid permutations (for storing permutations that themselves conform to NPC's requirements, but do not pair with any BodyGen morphs). Must be compatible with the BodyGen morph stored in consistency
    let validPermutations_withoutBodyGen = [];
    let chosenMorph;
    let chosenMorph2;
    let permutationToReturn;
    let bConsistencyMorphExists = NPCinfo.consistencyIndex >= 0 && consistencyRecords[NPCinfo.consistencyIndex] !== undefined && consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs !== undefined;
    let bPermutationMorphConflict = false;
    let passConsistencyMessage = {};
    let currentVerboseReport = [];
    let previousIterationOutput = {}; 
    let removedSubgroupTracker = initializeRemovedSubgroupTracker();
    
    while (bValidChoice === false)
    {
       permutationToReturn = generatePermutation(assetPackSettings, NPCrecordHandle, userForcedAssignment, NPCinfo, consistencyRecords[NPCinfo.consistencyIndex], previousIterationOutput, removedSubgroupTracker, bEnableBodyGenIntegration, currentVerboseReport, out_writeVerbose, xelib, logMessage, attributeCache);
       Aux.logVerbose(currentVerboseReport.join("\n"), verboseReport, out_writeVerbose);
       currentVerboseReport = [];

       if (permutationToReturn === undefined)
       {
           break; // if no permutation is able to be generated for this NPC at any point, regardless of BodyGen compatibility, break and report error to user.
       }
       else
       {
           bValidChoice = true; // unless the BodyGen check below sets it back to false, in which case another permutation will be generated
       }

        // Get BodyGen for current permutation
        
        if (bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false && Object.keys(BGcategorizedMorphs[NPCinfo.gender]).length > 0) // gender check to avoid wasting time on NPCs that don't have morphs assigned
        {
            Aux.logVerbose("Checking if the generated permutation is compatible with a BodyGen morph.", verboseReport, out_writeVerbose);
            validPermutations_withoutBodyGen.push(permutationToReturn);
            // is the chosen permutation compatible with the consistency morph?
            chosenMorph = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, permutationToReturn, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, passConsistencyMessage);
            
            // if the chosen morph is undefined, look to see if a morph would be available to the NPC without the constraints imposed by this permutation
            if (chosenMorph === undefined)
            {
                Aux.logVerbose("No morph could be selected in conjunction with the current permutation. Checking if a morph would be valid without the restriction imposed by this permutation.", verboseReport, out_writeVerbose);
                chosenMorph2 = BGI.assignMorphs(NPCrecordHandle, bodyGenConfig, BGcategorizedMorphs, NPCinfo, bEnableConsistency, consistencyRecords, undefined, userForcedAssignment, bLinkNPCsWithSameName, linkedNPCbodygen, NPClinkGroup, true, raceAliases, attributeCache, logMessage, {});
                // If not, no need to explore other permutations for compatibilty. keep this permutation, don't assign the morph, and let index.js call assignMorphs(again) with the error logging unsuppressed to alert the user. Since the reasons for listed for failed morphs will be unrelated to the chosen permutation, no need to flag the user here
                if (chosenMorph2 === undefined)
                {
                    Aux.logVerbose("No morph could be selected for this NPC even without the restrictions imposed by the chosen permutation. Therefore, the current permutation will be kept. The morph generation function will run again and will notify the user of why a morph could not be assigned for this NPC.", verboseReport, out_writeVerbose);
                    return permutationToReturn;
                }
                else
                {
                    Aux.logVerbose("A morph could be selected for this NPC without the restrictions imposed by the chosen permutation. Therefore, the current permutation will be stored in a backup list. If no permutation turns out to be compatible with morph generation, one of the permutations from this backup list will be selected.", verboseReport, out_writeVerbose);
                    bPermutationMorphConflict = true;
                }
            }

            // if BGI.assignMorphs was able to pick a valid morph for this permutation:

            // if there is no consistency morph for this NPC
            // OR if there is a consistency morph for this NPC and the chosen morph is the consistency morph
            // OR if the consistency morph was invalid (indicated by passConsistencyMessage.message being not undefined)
            // keep both the current valid permutation and the current valid morph
            else if (bConsistencyMorphExists === false || (bConsistencyMorphExists === true && chosenMorph.morphs === consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs) || passConsistencyMessage.message !== undefined)
            {
                Aux.logVerbose("The chosen permutation was compatible with a BodyGen morph. Assigning this permutation/morph combination to the NPC.", verboseReport, out_writeVerbose);
                assignedBodyGen[NPCinfo.formID] = chosenMorph;
                return permutationToReturn;
            }

            // if there is a valid consistency morph for this NPC and the chosen morph is NOT the consistency morph, store both as fallback options
            else if (bConsistencyMorphExists === true && passConsistencyMessage.message === undefined && chosenMorph.morphs !== consistencyRecords[NPCinfo.consistencyIndex].assignedMorphs)
            {
                Aux.logVerbose("The chosen permutation was compatible with a BodyGen morph, but this morph was NOT the consistency morph. The current permutation will be stored in a backup list and the patcher will attempt to generate a new permtation that is compatible with the consistency morph. If no permutation is compatible with the consistency morph, the backed up permutation will be used.", verboseReport, out_writeVerbose);
                validPermutations_withoutConsistency.push([permutationToReturn, chosenMorph]);
            }

            // if conditions to return have not yet been met, BodyGen criteria have not been satisfied so loop through other permutations
            bValidChoice = false;
        }
        else
        {
            Aux.logVerbose("The chosen permutation is accepted and will be assigned to the NPC.", verboseReport, out_writeVerbose);
            return permutationToReturn;
        }
    }

    // if no permutation was drawn with the consistency body morph, but there was a permutation drawn compatible with a non-consistency morph, warn the user that the consistency morph will be overwriten
    if (validPermutations_withoutConsistency.length >  0)
    {
        logMessage("\nAsset Assignment: Could not assign a permutation to NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") that is compatible with its consistency BodyGen morph. A valid permutation was assigned, but BodyGen assignment will be re-randomized.");
        assignedBodyGen[NPCinfo.formID] = validPermutations_withoutConsistency[0][1];
        Aux.logVerbose("Could not assign a permutation that is compatible with the current NPC's consistency BodyGen morph. The following permutation from the backup list will be assigned to the NPC, and a new BodyGen morph will be assigned:\n" + validPermutations_withoutConsistency[0][0].nameString, verboseReport, out_writeVerbose);
        return validPermutations_withoutConsistency[0][0];
    }

    // if the function gets this far, it means that bodygen is enabled and none of the permutations picked had a compatible bodygen.
    if (bPermutationMorphConflict === true) // if there are morphs that would be available to the NPC without the permutation's constraints, notify the user of the conflict
    {
        logMessage("\nAsset Assignment: NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was not compatible with any permutation + BodyGen morph combination due to mutually conflicting constraints. A valid permutation was assigned, but BodyGen assignment will proceed without respecting this permutation's constraints.")
        Aux.logVerbose("Could not assign a permutation that was compatible with a BodyGen morph. The following permutation was assigned, and a BodyGen morph will be chosen without regard to this permutation's constraints:\n" + validPermutations_withoutBodyGen[0].nameString, verboseReport, out_writeVerbose);
        return validPermutations_withoutBodyGen[0];
    }

    Aux.logVerbose("No valid permutation could be generated under any circumstance for this NPC. No permutation will be assigned to this NPC", verboseReport, out_writeVerbose);
    return undefined; // any successful case will have returned from above
}

function initializeRemovedSubgroupTracker()
{
    let tracker = {};
    tracker.chosenUniqueSeeds = []; // when the length of this array reaches numPossibleSeeds, remove one of the previous permutation's subgroups
    tracker.currentSubgroupIndex = 0; // index of the subgroup being removed. If removing the previously generated subgroup at this index reslults in no valid permutations, remove the subgroup at the next index. If all subgroups have been removed, try removing them from the next previously-genereated permutation
    tracker.currentPermutationIndex = 0; // index of the parent permutation whose subgroups are being removed (e.g. if it's the first previously generated permutation, second, etc.)
    tracker.splicedSubgroup = {};
    tracker.splicedSubgroupCoordinates = [];
    tracker.previouslyRemovedSubgroups = []; // so that if two previously generated permutations include the same subgroup, the patcher doesn't waste time removing the same subgroup twice
    return tracker;
}

function generatePermutation (assetPackSettings, NPCrecordHandle, userForcedAssignment, NPCinfo, consistencyInfo, previousIterationOutput, removedSubgroupTracker, bEnableBodyGenIntegration, verboseReport, out_writeVerbose, xelib, logMessage, attributeCache) // assetPackSettings here is a deep copy and can be pruned.
{
    let permutation = {};

    let subgroupChoiceListPrimary = [];
    let subgroupChoiceListSecondary = [];
    let seedSubgroup = {};
    let currentSubgroup = {};
    let chosenAssetPack;
    let bValidChoice = false;
    let bSubgroupCompatibleWithPermutation = false;
    let bSubgroupCompatibleWithNPC = false;
    let bPermutationCreated = false;

    let trialFlattenedSubgroups = [];
    let trialPermutation = {};
    let trialSubgroup = {};

    let flattenedSubgroupArchive = [];
    let permutationArchive = [];

    let pre_filtered = [];

    let resolveConflictsError = [];
    let verboseLog_UserForceList = [];
    let bFilteredByUserForceList = false;
    let verboseLog_ForceIfList = [];
    let bFilteredByForceIf = false;
    let verboseLog_Consistency = [];
    let pre_consistency = [];
    let bFilteredByConsistency = false;
    let fallbackStatement = "";

    // specifically for if this function is called multiple times
    let bFirstTimeFunctionCalled = false; // if this is true, then this is the first time generatePermutation() has been called; e.g. there is no conflict with generating BodyGen Morphs that requires generating a different permutation 
    reinitializeRemovedSubgroupTracker(removedSubgroupTracker);

    if (Object.keys(previousIterationOutput).length === 0)
    {
        bFirstTimeFunctionCalled = true;
        pre_filtered = angular.copy(assetPackSettings);
        pre_consistency = angular.copy(assetPackSettings);
        bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment, verboseLog_UserForceList, out_writeVerbose, logMessage);
        bFilteredByForceIf = filterSubgroupsByForceIf(assetPackSettings, NPCrecordHandle, verboseLog_ForceIfList, out_writeVerbose, logMessage, xelib, attributeCache);
        bFilteredByConsistency = filterSubgroupsByConsistency(assetPackSettings, consistencyInfo, NPCinfo, pre_consistency, verboseLog_Consistency, out_writeVerbose, logMessage);

        previousIterationOutput.generatedPermutationSubgroups = [];
        previousIterationOutput.generatedPermutationNameStrings = [];
        previousIterationOutput.generatedPermutationAssetPacks = [];
    }
    else
    {  
        bFilteredByUserForceList = previousIterationOutput.bFilteredByUserForceList;
        bFilteredByForceIf = previousIterationOutput.bFilteredByForceIf;
        if (previousIterationOutput.bFilteredByConsistency === true)
        {
            bFilteredByConsistency = false; // if the previous iteration resulted in the consistency permutation, the current iteration must break it
            assetPackSettings = previousIterationOutput.pre_consistency; // get rid of consistency filtering
        }
        else
        {
            assetPackSettings = previousIterationOutput.assetPackSettings;
        }
        pre_filtered = previousIterationOutput.pre_filtered;
        pre_consistency = previousIterationOutput.pre_consistency;
        Aux.logVerbose("\nRe-entering permutation generation function.\n", verboseReport, out_writeVerbose);
    }

    // verbose logging
    Aux.logVerbose("\nGENERATING A NEW PERMUTATION\nConfigs available at start:\n" + Aux.formatAssetPacksForVerbose(pre_filtered, false), verboseReport, out_writeVerbose);
    if (bFilteredByUserForceList === true || out_writeVerbose.forceFullLogging === true || out_writeVerbose.reportThisNPC === true)
    {
        verboseReport.push(...verboseLog_UserForceList);
    }
    else
    {
        verboseReport.push("No User-Forced Subgroups were set for this NPC. No filtering by User-Forced Subgroups is required.\n");
    }
    if (bFilteredByForceIf === true)
    {
        verboseReport.push(...verboseLog_ForceIfList);
    }
    else
    {
        verboseReport.push("No ForceIf attributes from any available subgroup were applicable to this NPC. No filtering by ForceIf is required.\n");
    }
    if (bFilteredByConsistency === true || out_writeVerbose.forceFullLogging === true || out_writeVerbose.reportThisNPC === true)
    {
        verboseReport.push(...verboseLog_Consistency);
    }
    else
    {
        verboseReport.push("No consistency entry was found for this NPC. No filtering by consistency is required.\n");
    }
    //

    while (bPermutationCreated === false)
    {
        // pick a nucleating subgroup  
        subgroupChoiceListPrimary = [];     
        while (subgroupChoiceListPrimary.length === 0) 
        {
            Aux.logVerbose("Choosing a seed subgroup from the following list:\n" + Aux.formatAssetPacksForVerbose(assetPackSettings, true), verboseReport, out_writeVerbose);
            subgroupChoiceListPrimary = generateSubgroupChoiceList(assetPackSettings, verboseReport, out_writeVerbose);

            if (bFirstTimeFunctionCalled === false && filterSubgroupsByPreviousPermutation(removedSubgroupTracker, assetPackSettings, previousIterationOutput, subgroupChoiceListPrimary, verboseReport, out_writeVerbose) === false)
            {
                break;
            }

            if (subgroupChoiceListPrimary.length === 0) // if no valid seed subgroups remain, try removing previously applied filters
            {
                // if the list of subgroups has been filtered by consistency, try generating a non-consistency permutation.
                if (bFilteredByConsistency === true)
                {
                    assetPackSettings = pre_consistency;
                    bFilteredByConsistency = false;
                    fallbackStatement += "\nThe consistency permutation was invalid according to the current config file settings. Falling back to a random permutation.";
                    Aux.logVerbose("\t\tThe consistency permutation was invalid according to the current config file settings. Falling back to a random permutation.", verboseReport, out_writeVerbose);
                    out_writeVerbose.reportThisNPC = true;
                }

                // if the list of subgroups has been filtered by BOTH user force list AND forceIf, try filtering only by user force list
                else if (bFilteredByUserForceList === true && bFilteredByForceIf === true)
                {
                    assetPackSettings = angular.copy(pre_filtered);
                    bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment, logMessage);
                    bFilteredByForceIf = false;
                    fallbackStatement += "\nNo valid permutations were generated when filtering by user-forced assignments AND forceIf assignments. Falling back to filtering only by user-forced assignments.";
                    Aux.logVerbose("\t\tNo valid permutations were generated when filtering by user-forced assignments AND forceIf assignments. Falling back to filtering only by user-forced assignments", verboseReport, out_writeVerbose);
                    out_writeVerbose.reportThisNPC = true;
                }

                // if the list of subgroups has been filtered ONLY by forceIf:
                else if (bFilteredByForceIf === true)
                {
                    // if a user force list exists, try filtering only on that
                    if (bFilteredByUserForceList === true)
                    {
                        assetPackSettings = angular.copy(pre_filtered);
                        bFilteredByUserForceList = filterSubgroupsByForceList(assetPackSettings, userForcedAssignment, logMessage);
                        fallbackStatement += "\nNo valid permutations were generated when filtering by forceIf assignments. Falling back to filtering only by user-forced assignments.";
                        Aux.logVerbose("\t\tNo valid permutations were generated when filtering by forceIf assignments. Falling back to filtering only by user-forced assignments.\n", verboseReport, out_writeVerbose);
                    }
                    // if a user force list does not exist, try generating a permutation without filtering
                    else
                    {
                        assetPackSettings = angular.copy(pre_filtered);
                        fallbackStatement += "\nNo valid permutations were generated when filtering by forceIf assignments. Falling back to unfiltered subgroups.";
                        Aux.logVerbose("\t\tNo valid permutations were generated when filtering by forceIf assignments. Falling back to unfiltered subgroups.\n", verboseReport, out_writeVerbose);
                    }
                    bFilteredByForceIf = false;
                    out_writeVerbose.reportThisNPC = true;
                }

                // if the list of subgroups has been filtered ONLY by user forced list, try generating a permutation with only filtering by forceIf
                else if (bFilteredByUserForceList === true)
                {
                    assetPackSettings = angular.copy(pre_filtered);
                    bFilteredByForceIf = filterSubgroupsByForceIf(assetPackSettings, NPCrecordHandle, verboseLog_ForceIfList, out_writeVerbose, logMessage, xelib, attributeCache);
                    if (bFilteredByForceIf === true)
                    {
                        fallbackStatement += "\nNo valid permutations were generated when filtering by user-forced assignments. Falling back to filtering only by ForceIf subgroups.";
                        Aux.logVerbose("\t\tNo valid permutations were generated when filtering by user-forced assignments. Falling back to filtering only by ForceIf subgroups.\n", verboseReport, out_writeVerbose);
                    }
                    else
                    {
                        fallbackStatement += "\nNo valid permutations were generated when filtering by user-forced assignments. Falling back to unfiltered subgroups.";
                        Aux.logVerbose("\t\tNo valid permutations were generated when filtering by user-forced assignments. Falling back to unfiltered subgroups.\n", verboseReport, out_writeVerbose);
                    }
                    bFilteredByUserForceList = false;
                    out_writeVerbose.reportThisNPC = true;
                }
                else
                {
                    Aux.logVerbose("\t\tNo permutations could be generated even without filtering. Aborting permutation generation.", verboseReport, out_writeVerbose);
                    out_writeVerbose.reportThisNPC = true;
                    break; // break out of the seed generation loop
                }
            }
        }
        
        // repeat the empty subgroupChoiceListPrimary check to account for the fallbacks above
        if (subgroupChoiceListPrimary.length === 0) // if no valid seed subgroups remain
        {
            break; // if no permutations could be generated even without filtering, break out of the main loop and return
        }

        seedSubgroup = Aux.chooseRandomFromArray(subgroupChoiceListPrimary);
        chosenAssetPack = assetPackSettings[Aux.getAssetPackIndexByName(seedSubgroup.parentAssetPack, assetPackSettings)];

        if (bFirstTimeFunctionCalled === false)
        {
            updateRemovedSubgroupTrackerUniqueSeeds(removedSubgroupTracker, seedSubgroup);  
        }

        Aux.logVerbose("Chosen seed subgroup: " + seedSubgroup.id + " (" + chosenAssetPack.groupName + ")\n" + "Details: \n" + JSON.stringify(seedSubgroup, null, '\t') + "\n", verboseReport, out_writeVerbose);

        // generate archive of available subgroups at each stage of permuation building to facilitate backtracking
        flattenedSubgroupArchive = [];
        permutationArchive = [];
        for (let i = 0; i < chosenAssetPack.flattenedSubgroups.length; i++)
        {
            flattenedSubgroupArchive.push([]);
            permutationArchive.push({});
        }
        //

        permutation = new permutationHolder(chosenAssetPack.groupName);
        permutation.gender = chosenAssetPack.gender;
        addRequiredSubgroupsToPermutation(seedSubgroup, permutation);
        addExcludedSubgroupsToPermutation(seedSubgroup, permutation);

        // filter the rest of the subgroups to comply with the initial requirements and exclusions
        if (filterRequiredSubgroups(chosenAssetPack.flattenedSubgroups, permutation.requiredSubgroups, 0, out_writeVerbose, verboseReport) === false)
        {
            Aux.logVerbose("Choosing a new seed subgroup.", verboseReport, out_writeVerbose);
            Aux.stripSubgroupInstancesFromList(seedSubgroup, chosenAssetPack.flattenedSubgroups[seedSubgroup.topLevelIndex]);
            continue; // choose new seed subgroup
        }

        // fill out the rest of the permutation

        let flattenedSubgroupsSecondary = Aux.copyFlattenedSubgroupArray(chosenAssetPack.flattenedSubgroups);
        flattenedSubgroupsSecondary[seedSubgroup.topLevelIndex] = [seedSubgroup]; // since the only subgroup that works here is the seed subgroup, make sure that the only subgroup in the array is the seed subgroup

        for (let i = 0; i < flattenedSubgroupsSecondary.length; i++)
        {
            flattenedSubgroupArchive[i] = Aux.copyFlattenedSubgroupArray(flattenedSubgroupsSecondary);
            permutationArchive[i] = angular.copy(permutation);

            bValidChoice = false;

            while (bValidChoice === false && flattenedSubgroupsSecondary[i].length > 0)
            {
                bSubgroupCompatibleWithPermutation = false;
                bSubgroupCompatibleWithNPC = false;

                subgroupChoiceListSecondary = Aux.generateSubgroupArrayByMultiplicity(flattenedSubgroupsSecondary[i], {});
                currentSubgroup = Aux.chooseRandomFromArray(subgroupChoiceListSecondary);

                Aux.logVerbose("Choosing subgroup for permutation at position " + i + "\nChoices: \n" + Aux.formatFlattenedSubgroupsForVerbose(flattenedSubgroupsSecondary, true) + "\nChosen subgroup: " + currentSubgroup.id + "\nDetails: \n" + JSON.stringify(currentSubgroup, null, '\t') + "\n", verboseReport, out_writeVerbose);

                trialPermutation = angular.copy(permutation);
                trialSubgroup = angular.copy(currentSubgroup);
                trialFlattenedSubgroups = Aux.copyFlattenedSubgroupArray(flattenedSubgroupsSecondary);

                resolveConflictsError = [""];
                if (bResolveSubgroupPermutationConflicts(trialSubgroup, trialPermutation, chosenAssetPack.subgroups, bEnableBodyGenIntegration, resolveConflictsError) === true)
                {                    
                    // copy trialSubgroup's requiredSubgroups into trialPermutation
                    Aux.copyObjectArrayInto(trialSubgroup.requiredSubgroups, trialPermutation.requiredSubgroups, true);
                    if (filterRequiredSubgroups(trialFlattenedSubgroups, trialPermutation.requiredSubgroups, i, out_writeVerbose, verboseReport) !== false && bSubgroupRequirementsMet(trialSubgroup, trialPermutation, out_writeVerbose, verboseReport) === true) // returns false if none of the remaining subgroups are compatible with the filter
                    {
                        // copy trialSubgroup's exlcudedSubgroups into trialPermutation
                        trialPermutation.excludedSubgroups.push(...trialSubgroup.excludedSubgroups);
                        if (filterExcludedSubgroups(trialFlattenedSubgroups, trialPermutation.excludedSubgroups, i, out_writeVerbose, verboseReport) !== false)
                        {
                            bValidChoice = true;
                        }
                        else
                        {
                            Aux.logVerbose("\t\tSubgroup " + currentSubgroup.id + " (or its required subgroups) is not compatible with the current permutation's excluded subgroups and will be discarded.", verboseReport, out_writeVerbose);
                        }
                    }
                    else
                    {
                        Aux.logVerbose("\t\tSubgroup " + currentSubgroup.id + " (or its required subgroups) is not compatible with the current permutation and will be discarded.", verboseReport, out_writeVerbose);
                    }
                }
                else
                {
                    Aux.logVerbose("\t\tSubgroup " + currentSubgroup.id + " is not compatible with the current permutation because: " + resolveConflictsError[0], verboseReport, out_writeVerbose);
                }

                if (bValidChoice === true)
                {
                    permutation = trialPermutation;
                    currentSubgroup = trialSubgroup;
                    appendSubgroupToPH(currentSubgroup, permutation);
                    flattenedSubgroupsSecondary = trialFlattenedSubgroups;
                    Aux.logVerbose("\n\t\tSubgroup " + currentSubgroup.id + " has passed all checks.\n\t\t" + "Current permutation: " + permutation.nameString + "\n", verboseReport, out_writeVerbose);
                }
                else
                {
                    Aux.logVerbose("\t\tRemoving subgroup " + currentSubgroup.id + " from the available subgroup list", verboseReport, out_writeVerbose);
                    Aux.stripSubgroupInstancesFromList(currentSubgroup, flattenedSubgroupsSecondary[currentSubgroup.topLevelIndex]);
                }
            } 

            if (flattenedSubgroupsSecondary[i].length === 0 && bValidChoice === false)
            {
                // if none of the current subgroups at the current index are valid:
                Aux.logVerbose("\t\tNo subgroups remain at index " + i + ".", verboseReport, out_writeVerbose);

                // if this is the first subgroup, pick a different seed
                if (i === 0)
                {
                    Aux.logVerbose("\t\tChoosing a different seed subgroup.", verboseReport, out_writeVerbose);
                    Aux.stripSubgroupInstancesFromList(seedSubgroup, chosenAssetPack.flattenedSubgroups[seedSubgroup.topLevelIndex]); // since chosenAssetPack links back to assetPackSettings by reference, this edit will carry through to assetPackSettings, stripping the subgroup from the primary selection list.
                    break; // out of for loop. Since bPermutationCreated = false in this case, this will go to the start of the main while loop to draw a new seedSubgroup
                }
                else
                {
                    Aux.logVerbose("\t\tBacktracking to index " + (i - 1).toString() + ", removing the current subgroup (" + permutation.subgroups[i-1].id + "), and choosing a different subgroup for this position.", verboseReport, out_writeVerbose);
                    // go back to the previous index, restoring the subgroups available to choose from at that index
                    i--; // now at previous index
                    Aux.stripSubgroupInstancesFromList(permutation.subgroups[i], flattenedSubgroupArchive[i][i]); 
                    flattenedSubgroupsSecondary = flattenedSubgroupArchive[i];
                    permutation = permutationArchive[i];
                    i--; // go back one more so that the next iteration of the for loop brings i back to the correct index
                    Aux.logVerbose("\nCurrently available subgroups:\n" + Aux.formatFlattenedSubgroupsForVerbose(flattenedSubgroupsSecondary, false), verboseReport, out_writeVerbose);
                }
            }
            else if (permutation.subgroups.length === chosenAssetPack.flattenedSubgroups.length)
            {
                // if this is not the first time generating a permutation, check to make sure it has not been generated before
                if (bFirstTimeFunctionCalled === false && previousIterationOutput.generatedPermutationNameStrings.includes(permutation.nameString))
                {
                    Aux.logVerbose("Permutation " + permutation.nameString + " has been generated previously for this NPC. Attempting to generate a new permutation.", verboseReport, out_writeVerbose);
                    break;
                }
                else
                {
                    bPermutationCreated = true;
                }
            }
        }
    }

    if (bPermutationCreated === true)
    {
        if (fallbackStatement !== "")
        {
            logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "): " + fallbackStatement);
        }
        Aux.logVerbose("============================================================\nA valid permutation was generated and sent to the main loop.\n============================================================\n", verboseReport, out_writeVerbose);

        // store results of current run in case of a BodyGen conflict resulting in this function needing to be rerun
        previousIterationOutput.bFilteredByUserForceList = bFilteredByUserForceList;
        previousIterationOutput.bFilteredByForceIf = bFilteredByForceIf;
        previousIterationOutput.bFilteredByConsistency = bFilteredByConsistency
        previousIterationOutput.assetPackSettings = assetPackSettings;
        previousIterationOutput.pre_consistency = pre_consistency;
        previousIterationOutput.pre_filtered = pre_filtered;
        previousIterationOutput.generatedPermutationSubgroups.push(Aux.getPermutationSubgroupIDs(permutation));
        previousIterationOutput.generatedPermutationNameStrings.push(permutation.nameString);
        previousIterationOutput.generatedPermutationAssetPacks.push(permutation.sourceAssetPack);

        return permutation;
    }
    else
    {
        Aux.logVerbose("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nNo valid permutation could be generated.\nxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n", verboseReport, out_writeVerbose);
        return undefined;
    }
};


bResolveSubgroupPermutationConflicts = function(subgroup, permutation, subgroupHierarchy, bEnableBodyGenIntegration, verboseError)
{
    // bRemoveDuplicates must be set to false to handle the allowed/disallowed Races compatibilization. Otherwise the logic fails.
    if (bCompatibilizeAllowedRaces(subgroup, permutation, false) === false) { verboseError[0] = "The subgroup's allowedRaces are incompatible with the permutation's allowedRaces."; return false; } // trims only subgroup
    if (bCompatibilizeAllowedRaces(permutation, subgroup, false) === false) { verboseError[0] = "The permutation's allowedRaces are incompatible with the subgroup's allowedRaces."; return false; } // trims only permutation     
    if (bCompatibilizeDisallowedRaces(subgroup, permutation, false) === false) { verboseError[0] = "The subgroup's allowedRaces are incompatible with the permutation's disallowedRaces."; return false; } // checks only subgroup
    if (bCompatibilizeDisallowedRaces(permutation, subgroup, false) === false) { verboseError[0] = "The permutation's allowedRaces are incompatible with the subgroup's disallowedRaces."; return false; } // checks only permutation
    //allowed/disallowedRaces are trimmed back to their unique constitituents when subgroup is added to permutation in appendSubgroupToPH
    compatibilizeAllowedAttributes(subgroup, permutation, true); 
    compatibilizeDisallowedAttributes(subgroup, permutation, true);
    compatibilizeForceIfAttributes(subgroup, permutation, true);
    compatibilizeWeightRange(subgroup, permutation);     
    
    if (bCompatibilizeRequiredSubgroups(subgroup, permutation, subgroupHierarchy) === false) { verboseError[0] = "The subgroup's and permutation's required subgroups are incompatible."; return false; }
    
    if (bCompatibilizeExcludedSubgroups(subgroup, permutation) === false)  { verboseError[0] = "The subgroup's excluded subgroups are incompatible with the permutation's excluded subgroups."; return false; } // checks only subgroup (removeDuplicates = false to avoid screwing up the reverse check on the following line)
    if (bCompatibilizeExcludedSubgroups(permutation, subgroup) === false)  { verboseError[0] = "The permutation's excluded subgroups are incompatible with the subgroup's excluded subgroups."; return false; } // checks only permutation 
    compatibilizePaths(subgroup, permutation, true);

    if (bEnableBodyGenIntegration === true)
    {
        if (bCompatibilizeAllowedBodyGen(subgroup, permutation, true) === false) { verboseError[0] = "The subgroup's and permutation's allowed BodyGen morphs are incompatible."; return false; } 
        if (bCompatibilizeDisallowedBodyGen(subgroup, permutation, false) === false) { verboseError[0] = "The subgroup's disallowed BodyGen morphs are incompatible with the permutation's disallowed BodyGen morphs."; return false; } // checks only subgroup
        if (bCompatibilizeDisallowedBodyGen(permutation, subgroup, true) === false) { verboseError[0] = "The permutation's disallowed BodyGen morphs are incompatible with the subgroup's disallowed BodyGen morphs."; return false; } // checks only permutation
    }

    return true;
};

appendSubgroupToPH = function(subgroup, permutation)
{
    if (permutation.nameString === "")
    {
        permutation.nameString = subgroup.id;
    }
    else
    {
        permutation.nameString += "," + subgroup.id;
    }

    permutation.subgroups.push(subgroup); 
    permutation.contributingBottomLevelSubgroupIDs.push(subgroup.id);
    permutation.contributingSubgroupIDs.push(subgroup.containedSubgroupIDs);
    permutation.contributingSubgroupNames.push(subgroup.containedSubgroupNames);
    //
    // The remaining permutation elements below are also unshifted to have consistent indices with the above elements, but this is for log legibility and not logical necessity
    //Aux.copyObjectArrayInto(subgroup.requiredSubgroups, permutation.requiredSubgroups, true);
    //permutation.excludedSubgroups.push(...subgroup.excludedSubgroups);

    permutation.allowedRaces.push(...subgroup.allowedRaces);
    permutation.disallowedRaces.push(...subgroup.disallowedRaces);

    permutation.allowedRaces = Aux.getArrayUniques(permutation.allowedRaces);
    permutation.disallowedRaces = Aux.getArrayUniques(permutation.disallowedRaces); 

    permutation.allowedAttributes.push(...Aux.convertAttributePairsToObjects(subgroup.allowedAttributes, subgroup));
    permutation.disallowedAttributes.push(...Aux.convertAttributePairsToObjects(subgroup.disallowedAttributes, subgroup));
    permutation.forceIfAttributes.push(...Aux.convertAttributePairsToObjects(subgroup.forceIfAttributes, subgroup));
    permutation.weightRange = subgroup.weightRange; // subgroup.weightRange has been compared to permutation.weightRange and is either tighter or the same
    permutation.addKeywords.push(...subgroup.addKeywords);
    permutation.paths.push(...subgroup.paths);

    if (subgroup.distributionEnabled === false) { permutation.distributionEnabled = false; }
    if (subgroup.allowUnique === false) { permutation.allowUnique = false; }
    if (subgroup.allowNonUnique === false) { permutation.allowNonUnique = false; }
    permutation.probabilityWeighting *= subgroup.probabilityWeighting;

    Aux.copyObjectArrayInto(subgroup.allowedBodyGenDescriptors, permutation.allowedBodyGenDescriptors, true);
    permutation.disallowedBodyGenDescriptors.push(...subgroup.disallowedBodyGenDescriptors);


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
};

// FUNCTIONS TO SUPPORT GENERATEPERMUTATIONS()
function reinitializeRemovedSubgroupTracker(tracker)
{
    tracker.chosenUniqueSeeds = [];
}

function filterSubgroupsByForceList(assetPacks, userForcedAssignment, verboseLog_UserForceList, out_writeVerbose, logMessage)
{
    bFiltered = false;
    let currentAssetPack;
    let forcedSubgroups = {};
    let forcedIndex = -1;

    if (userForcedAssignment === undefined || userForcedAssignment.forcedAssetPack === "")
    {
        return false;
    }
    Aux.logVerbose("Filtering assets by user force list.", verboseLog_UserForceList, out_writeVerbose);
    Aux.logVerbose("Forced asset pack: " + userForcedAssignment.forcedAssetPack, verboseLog_UserForceList, out_writeVerbose);
    let logstr = "Forced subgroups: ";
    for (let i = 0; i< userForcedAssignment.forcedSubgroups.length; i++)
    {
        logstr += userForcedAssignment.forcedSubgroups[i].id;
        if (i < userForcedAssignment.forcedSubgroups.length - 1)
        {
            logstr += ", ";
        }
    }
    Aux.logVerbose(logstr, verboseLog_UserForceList, out_writeVerbose);

    for (let i = 0; i < assetPacks.length; i++)
    {
        if (userForcedAssignment.forcedAssetPack !== assetPacks[i].groupName)
        {
            Aux.logVerbose("Removed asset pack " + assetPacks[i].groupName + " because it doesn't match the user-forced asset pack.", verboseLog_UserForceList, out_writeVerbose);
            assetPacks.splice(i, 1);
            i--;
            continue;
        }

        currentAssetPack = assetPacks[i];

        // if the user only specifies the asset pack, remove all other asset packs from this list and keep the entirety of this one. Otherwise, filter the subgroups to match what the user requested
        if (userForcedAssignment.forcedSubgroups.length > 0)
        {
            // find top-level indices of the forced subgroups
            for (let j = 0; j < userForcedAssignment.forcedSubgroups.length; j++)
            { 
                for (let k = 0; k < currentAssetPack.subgroups.length; k++)
                {
                    if (userForcedAssignment.forcedSubgroups[j].topLevelSubgroup === currentAssetPack.subgroups[k].id)
                    {
                        forcedIndex = k;
                        if (forcedSubgroups[forcedIndex] === undefined)
                        {
                            forcedSubgroups[forcedIndex] = [];
                        }
                        forcedSubgroups[forcedIndex].push(userForcedAssignment.forcedSubgroups[j].id);
                    }
                }
            }

            // remove all subgroups at forced top-level indices that don't comply with user assignment
            for (let [index, IDs] of Object.entries(forcedSubgroups))
            {
                let bForcedSubgroupFoundAtIndex = false;
                for (let j = 0; j < currentAssetPack.flattenedSubgroups[index].length; j++)
                {
                    if (bForcedArrayContainsSubgroup(IDs, currentAssetPack.flattenedSubgroups[index][j]) === false)
                    {
                        Aux.logVerbose("Removed subgroup " + currentAssetPack.flattenedSubgroups[index][j].id + " because it conflicts with user-forced subgroup at position " + index, verboseLog_UserForceList, out_writeVerbose);
                        currentAssetPack.flattenedSubgroups[index].splice(j, 1);
                        j--;
                    }
                    else
                    {
                        bForcedSubgroupFoundAtIndex = true;
                    }
                }
                if (bForcedSubgroupFoundAtIndex === false)
                {
                    logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "): None of the User-forced subgroups at position " + index + " (" + IDs.join(", ") + ") could be assigned.");
                    Aux.logVerbose("None of the User-forced subgroups at position " + index + " (" + IDs.join(", ") + ") were found within the currently available subgroups at this index. This requirement will be ignored.", verboseLog_UserForceList, out_writeVerbose);
                    out_writeVerbose.reportThisNPC = true;
                }
            }
        }
    }
    Aux.logVerbose("Available subgroups after filtering by user-forced assignments:\n" + Aux.formatAssetPacksForVerbose(assetPacks, false), verboseLog_UserForceList, out_writeVerbose);

    return true;
}

function bForcedArrayContainsSubgroup(forcedSubgroupList, subgroup)
{
    for (let i = 0; i < forcedSubgroupList.length; i++)
    {
        if (subgroup.containedSubgroupIDs.includes(forcedSubgroupList[i]) === true)
        {
            return true;
        }
    }
    return false;
}

function filterSubgroupsByForceIf(assetPacks, NPCrecordHandle, verboseLog_ForceIfList, out_writeVerbose, logMessage, xelib, attributeCache)
{
    let currentAssetPack;
    let matchedForceIfs = [];
    let matchedTopLevelSubgroups_Global = 0;
    let matchTracker = {};
    let currentSubgroup;
    let tmpSubgroupArray = [];
    let bCurrentTopLevelSubgroupMatched = false;

    Aux.logVerbose("Filtering assets by forceIf attributes.", verboseLog_ForceIfList, out_writeVerbose);

    // Get the number of matched subgroups per-subgroup index, and the number of matched top-level subgroups per-config file
    for (let i = 0; i < assetPacks.length; i++)
    {
        currentAssetPack = assetPacks[i];
        matchTracker[currentAssetPack.groupName] = [];
        matchTracker[currentAssetPack.groupName].matchedTopLevelSubgroups = 0;

        for (let j = 0; j < currentAssetPack.flattenedSubgroups.length; j++)
        {
            bCurrentTopLevelSubgroupMatched = false;

            matchTracker[currentAssetPack.groupName][j] = {};
            matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex = 0;

            for (let k = 0; k < currentAssetPack.flattenedSubgroups[j].length; k++)
            {
                currentSubgroup = currentAssetPack.flattenedSubgroups[j][k];
                matchedForceIfs = [];

                // Get the matched forceIfs from this subgroup
                for (let z = 0; z < currentSubgroup.forceIfAttributes.length; z++)
                {
                    if (Aux.bAttributeMatched(currentSubgroup.forceIfAttributes[z][0], currentSubgroup.forceIfAttributes[z][1], NPCrecordHandle, logMessage, xelib, attributeCache))
                    {
                        matchedForceIfs.push(currentSubgroup.forceIfAttributes[z]);
                        bCurrentTopLevelSubgroupMatched = true;
                    }
                }

                matchTracker[currentAssetPack.groupName][j][k] = matchedForceIfs;
                if (matchedForceIfs.length > matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex)
                {
                    matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex = matchedForceIfs.length;
                }
            }
 
            if (bCurrentTopLevelSubgroupMatched === true)
            {
                matchTracker[currentAssetPack.groupName].matchedTopLevelSubgroups++;
            }
        }

        // update maximum match tracker
        if (matchTracker[currentAssetPack.groupName].matchedTopLevelSubgroups > matchedTopLevelSubgroups_Global)
        {
            matchedTopLevelSubgroups_Global = matchTracker[currentAssetPack.groupName].matchedTopLevelSubgroups;
        }
    }

    Aux.logVerbose("Matched forceIf attributes by config file and subgroup:\n", verboseLog_ForceIfList, out_writeVerbose);
    for (let i = 0; i < assetPacks.length; i++)
    {
        Aux.logVerbose(assetPacks[i].groupName + ":", verboseLog_ForceIfList, out_writeVerbose);
        for (let j = 0; j < assetPacks[i].flattenedSubgroups.length; j++)
        {
            Aux.logVerbose(assetPacks[i].subgroups[j].id, verboseLog_ForceIfList, out_writeVerbose); // top-level subgroup
            for (let k = 0; k < assetPacks[i].flattenedSubgroups[j].length; k++)
            {
                Aux.logVerbose("\t" + assetPacks[i].flattenedSubgroups[j][k].id + ": " + matchTracker[assetPacks[i].groupName][j][k].length + Aux.formatForceIfAttributeArrayForVerbose(matchTracker[assetPacks[i].groupName][j][k]), verboseLog_ForceIfList, out_writeVerbose);
            }
        }
    }
    verboseLog_ForceIfList.push("");
    

    // get rid of any config files that have less top-level subgroups matched than the global maximum
    for (let i = 0; i < assetPacks.length; i++)
    {
        if (matchTracker[assetPacks[i].groupName].matchedTopLevelSubgroups < matchedTopLevelSubgroups_Global)
        {
            Aux.logVerbose("Removing asset pack " + assetPacks[i].groupName + " because it has " + matchTracker[assetPacks[i].groupName].matchedTopLevelSubgroups + " top-level subgroups with matched forceIf attributes, while a different config file had " + matchedTopLevelSubgroups_Global + " top-level subgroups with matched forceIf attributes.", verboseLog_ForceIfList, out_writeVerbose);
            assetPacks.splice(i, 1); 
            i--;
        }
    }

    // get rid of any subgroups that have less than the per-subgroup match count
    for (let i = 0; i < assetPacks.length; i++)
    {
        currentAssetPack = assetPacks[i];
        for (let j = 0; j < currentAssetPack.flattenedSubgroups.length; j++)
        {
            tmpSubgroupArray = [];
            for (let k = 0; k < currentAssetPack.flattenedSubgroups[j].length; k++)
            {
                if (matchTracker[currentAssetPack.groupName][j][k].length === matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex)
                {
                    tmpSubgroupArray.push(currentAssetPack.flattenedSubgroups[j][k]);

                    if (matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex > 0)
                    {
                        Aux.logVerbose(assetPacks[i].groupName + ": Keeping subgroup " + currentAssetPack.flattenedSubgroups[j][k].id + " at position " + j + "(" + currentAssetPack.subgroups[j].id + "): " + matchTracker[currentAssetPack.groupName][j][k].length +  " matched ForceIf attributes.", verboseLog_ForceIfList, out_writeVerbose);
                    }
                }
                else if (matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex > 0)
                {
                    Aux.logVerbose(assetPacks[i].groupName + ": Discarding subgroup " + currentAssetPack.flattenedSubgroups[j][k].id + " at position " + j + "(" + currentAssetPack.subgroups[j].id + "): " + matchTracker[currentAssetPack.groupName][j][k].length +  " matched ForceIf attributes (needed " + matchTracker[currentAssetPack.groupName][j].maxMatchCountPerIndex +").", verboseLog_ForceIfList, out_writeVerbose);
                }
            }
            currentAssetPack.flattenedSubgroups[j] = tmpSubgroupArray;
        }
    }
    Aux.logVerbose("Available subgroups after filtering by ForceIf Attributes:\n" + Aux.formatAssetPacksForVerbose(assetPacks, false), verboseLog_ForceIfList, out_writeVerbose);

    return matchedTopLevelSubgroups_Global > 0;
}

function filterSubgroupsByConsistency(assetPacks, consistencyInfo, NPCinfo, pre_consistency, verboseLog_Consistency, out_writeVerbose, logMessage)
{
    let failedMatchArray = [];

    if (consistencyInfo === undefined || consistencyInfo.assignedAssetPack === undefined || consistencyInfo.assignedAssetPack === "")
    {
        return false;
    }

    Aux.logVerbose("Consistency record found for current NPC:\n" + "Asset Pack: " + consistencyInfo.assignedAssetPack + "\n" + "Permutation: " + consistencyInfo.assignedPermutation, verboseLog_Consistency, out_writeVerbose);

    for (let i = 0; i < assetPacks.length; i++)
    {
        if (assetPacks[i].groupName !== consistencyInfo.assignedAssetPack)
        {
            Aux.logVerbose("Removing asset pack " + assetPacks[i].groupName + " because it does not match the consistency record", verboseLog_Consistency, out_writeVerbose);
            assetPacks.splice(i, 1);
            i--;
        }
        else
        {
            let assignedSubgroups = consistencyInfo.assignedPermutation.split(',');
            let consistencySubgroup = {};
            for (let j = 0; j < assetPacks[i].flattenedSubgroups.length; j++)
            {
                consistencySubgroup = Aux.getSubgroupByIDfromArray(assignedSubgroups[j], assetPacks[i].flattenedSubgroups[j]);
                if (consistencySubgroup === undefined)
                {
                    failedMatchArray.push(assignedSubgroups[j]);
                    Aux.logVerbose("Could not find the subgroup " + assignedSubgroups[j] + " in the list of available subgroups. Either its config file was removed or modified, or it was filtered out by user-forced assignments or ForceIf attributes. A random subgroup will be used at this index.", verboseLog_Consistency, out_writeVerbose);
                    out_writeVerbose.reportThisNPC = true;
                }
                else
                {
                    assetPacks[i].flattenedSubgroups[j] = [consistencySubgroup];
                }
            }
        }
    }

    if (assetPacks.length === 0)
    {
        logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "): Consistency asset pack " + consistencyInfo.assignedAssetPack + " could not be assigned. Generating a random permutation");
        for (let i = 0; i < pre_consistency.length; i++)
        {
            assetPacks.push(pre_consistency[i]);
        }
        Aux.logVerbose("\nNone of the available config files match the consistency asset pack. Generating random permutation for this NPC.\n", verboseLog_Consistency, out_writeVerbose);
        out_writeVerbose.reportThisNPC = true;

        return false;
    }

    if (failedMatchArray.length > 0)
    {
        let sgString = ""
        for (let i = 0; i < failedMatchArray.length; i++)
        {
            sgString += failedMatchArray[i];
            if (i < failedMatchArray.length - 1)
            {
                sgString += ", ";
            }
        }

        logMessage("Warning for NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + "): Consistency subgroups " + sgString + " (" + consistencyInfo.assignedAssetPack + ") could not be assigned. Using a different subgroup at these positions.)");
        out_writeVerbose.reportThisNPC = true;
    }
    Aux.logVerbose("Available subgroups after filtering by consistency:\n" + Aux.formatAssetPacksForVerbose(assetPacks, false), verboseLog_Consistency, out_writeVerbose);

    // if none of the consistency subgroups could be matched, revert back to the pre-filtered list
    if (failedMatchArray.length === assetPacks[0].flattenedSubgroups.length) // at this point assetPacks[0] should be the consistency asset pack
    {
        // user has already been notified that these subgroups could not be assigned, so silently revert to the pre-filtered asset packs
        assetPacks.splice(0, 1);
        for (let i = 0; i < pre_consistency.length; i++)
        {
            assetPacks.push(pre_consistency[i]);
        }

        return false;
    }

    return true;
}

function generateSubgroupChoiceList(assetPackSettings, verboseReport, out_writeVerbose)
{
    let validAssetPacks = [];
    let chosenAssetPack = {};
    let allSubgroups = [];
    let weightedSubgroups = [];

    for (let i = 0; i < assetPackSettings.length; i++)
    {
        // check all indices to make sure subgroups haven't been filtered out
        let allIndicesPopulated = true;
        for (let j = 0; j < assetPackSettings[i].flattenedSubgroups.length; j++)
        {
            if (assetPackSettings[i].flattenedSubgroups[j].length === 0)
            {
                allIndicesPopulated = false;
                Aux.logVerbose("\nNo seed subgroups are available at index " + j + " in asset pack " + assetPackSettings[i].groupName +". No subgroups from this asset pack will be added to the available choice list unless a filtering layer is removed.\n", verboseReport, out_writeVerbose);
                break;
            }
        }

        if (allIndicesPopulated === true)
        {
            validAssetPacks.push(assetPackSettings[i]);
        }
    }

    if (validAssetPacks.length === 0)
    {
        Aux.logVerbose("No seed subgroup could be chosen.\n", verboseReport, out_writeVerbose);
    }
    else
    {
        chosenAssetPack = chooseAssetPackByWeight(validAssetPacks);
        generateChoiceListFromSubgroupList(chosenAssetPack.flattenedSubgroups, allSubgroups, weightedSubgroups);
    }

    
    if (weightedSubgroups.length > 0)
    {
        return weightedSubgroups; // discard the top-level subgroups that are not weighted by probability because they interfere with seed selection by probability weighting
    }
    else
    {
        return allSubgroups;
    }
}

function chooseAssetPackByWeight(assetPacks)
{
    let weightedList = [];
    for (let i = 0; i < assetPacks.length; i++)
    {
        for (let j = 0; j < assetPacks[i].probabilityWeighting; j++)
        {
            weightedList.push(assetPacks[i]);
        }
    }

    return Aux.chooseRandomFromArray(weightedList);
}

function generateChoiceListFromSubgroupList(flattenedSubgroups, allSubgroups, weightedSubgroups)
{
    let subgroupList = [];
    let weightReporter = {}; // have to make an object to return by reference because javascript doesn't support multiple return values from a function
    for (let i = 0; i < flattenedSubgroups.length; i++)
    {
        subgroupList = Aux.generateSubgroupArrayByMultiplicity(flattenedSubgroups[i], weightReporter);

        allSubgroups.push(...subgroupList);
        if (weightReporter.weighted === true)
        {
            weightedSubgroups.push(...subgroupList);
            weightReporter.weighted = false;
        }
    }
}

function addRequiredSubgroupsToPermutation(currentSubgroup, permutation)
{
    let currentSubgroup_Has_RequiredSubgroups = false;
    let req_Added = false;
    let compatibleFlag = false;
    let new_reqs = {};

    for (let index of Object.keys(currentSubgroup.requiredSubgroups))
    {
        new_reqs[index] = [];

        if (currentSubgroup.requiredSubgroups[index].length > 0)
        {
            currentSubgroup_Has_RequiredSubgroups = true;
        }

        if (permutation.requiredSubgroups[index] === undefined) // if no required subgroups exist at this index, simply add the ones from this subgroup
        {
            new_reqs[index] = [];
            for (let j = 0; j < currentSubgroup.requiredSubgroups[index].length; j++)
            {
                new_reqs[index].push(currentSubgroup.requiredSubgroups[index][j]);
                req_Added = true;
            }   
        }

        else if (permutation.requiredSubgroups[index].length > 0) // if required subgroups already exist at this index, only keep the ones that are mutually compatible
        {
            for (let i = 0; i < permutation.requiredSubgroups[index].length; i++)
            {
                for (let j = 0; j < currentSubgroup.requiredSubgroups[index].length; j++)
                {
                    if (permutation.requiredSubgroups[index][i].id === currentSubgroup.requiredSubgroups[index][j])
                    {
                        new_reqs[index].push(currentSubgroup.requiredSubgroups[index][j]);
                        req_Added = true;
                    }
                }
            }
        }

        else
        {
            let debug = "This should never be reached."
        }
        
    }

    if (currentSubgroup_Has_RequiredSubgroups === false)
    {
        compatibleFlag = true;
    }
    if (currentSubgroup_Has_RequiredSubgroups === true && req_Added === true)
    {
        for (let index of Object.keys(currentSubgroup.requiredSubgroups))
        {
            permutation.requiredSubgroups[index] = new_reqs[index];
        }
        compatibleFlag = true;
    }

    return compatibleFlag;
}

function addExcludedSubgroupsToPermutation(currentSubgroup, permutation)
{
    for (let i = 0; i < currentSubgroup.excludedSubgroups.length; i++)
    {
        permutation.excludedSubgroups.push(currentSubgroup.excludedSubgroups[i]);
    }
}

function filterRequiredSubgroups(flattenedSubgroups, requirements, startIndex, out_writeVerbose, verboseReport)
{
    if (Object.keys(requirements).length > 0)
    {
        Aux.logVerbose("Filtering available subgroups based on the following requirements:", verboseReport, out_writeVerbose);
        for (let [index, reqs] of Object.entries(requirements))
        {
            Aux.logVerbose("Index " + index + ": " + reqs.join(", "), verboseReport, out_writeVerbose);
        }
    }

    let validSubgroups = [];
    for (let i = startIndex; i < flattenedSubgroups.length; i++)
    {
        validSubgroups = [];
        if (requirements[i] !== undefined)
        {
            for (let j = 0; j < requirements[i].length; j++)
            {
                for (let k = 0; k < flattenedSubgroups[i].length; k++)
                {
                    if (flattenedSubgroups[i][k].containedSubgroupIDs.includes(requirements[i][j]))
                    {
                        validSubgroups.push(flattenedSubgroups[i][k]);
                    }
                }
            }
        }

        if (validSubgroups.length > 0)
        {
            flattenedSubgroups[i] = validSubgroups;
        }
        else if (requirements[i] !== undefined && validSubgroups.length === 0)
        {
            Aux.logVerbose("\t\tNo subgroups at index " + i + " matched the required subgroups for this position. \n\t\tFILTERING BY REQUIRED SUBGROUPS HAS FAILED.", verboseReport, out_writeVerbose);
            return false;
        }
    }

    if (Object.keys(requirements).length > 0)
    {
        Aux.logVerbose("Available subgroups after filtering by Required Subgroups:\n" + Aux.formatFlattenedSubgroupsForVerbose(flattenedSubgroups), verboseReport, out_writeVerbose);
    }
}

function filterExcludedSubgroups(flattenedSubgroups, exclusions, startIndex, out_writeVerbose, verboseReport)
{
    if (exclusions.length > 0)
    {
        Aux.logVerbose("Filtering subgroups based on the following exclusions: \n" + exclusions.join(", "), verboseReport, out_writeVerbose);
    }

    for (let i = startIndex; i < flattenedSubgroups.length; i++)
    {
        for (let j = 0; j < exclusions.length; j++)
        {
            for (let k = 0; k < flattenedSubgroups[i].length; k++)
            {
                if (flattenedSubgroups[i][k].containedSubgroupIDs.includes(exclusions[j]))
                {
                    flattenedSubgroups[i].splice(k, 1);
                    k--;
                }
            }
        }

        if (flattenedSubgroups[i].length === 0)
        {
            Aux.logVerbose("No subgroups at index " + i + " are compatible with the excluded subgroups for this position. Filtering by excluded subgroups has failed.", verboseReport, out_writeVerbose);
            return false;
        }
    }

    if (exclusions.length > 0)
    {
        Aux.logVerbose("Available subgroups after filtering by Excluded Subgroups:\n" + Aux.formatFlattenedSubgroupsForVerbose(flattenedSubgroups), verboseReport, out_writeVerbose);
    }
}

function bSubgroupRequirementsMet(subgroup, permutation, out_writeVerbose, verboseReport)
{
    if (Object.keys(subgroup.requiredSubgroups).length === 0)
    {
        return true;
    }
    Aux.logVerbose("Checking " + subgroup.id + "'s required subgroups for compatibility with the currently built permutation.", verboseReport, out_writeVerbose);

    for (let i = 0; i < permutation.subgroups.length; i++)
    {
        if (Aux.isSubgroupBallowedBySubgroupA_sRequiredSubgroups(subgroup, permutation.subgroups[i], i) === false)
        {
            Aux.logVerbose("Subgroup " + subgroup.id + " requires one of [" + subgroup.requiredSubgroups[i].join(", ") + "] at position " + i + " but the current permutation has " + permutation.subgroups[i].id + " at this position. This subgroup is not compatible with the current permutation.", verboseReport, out_writeVerbose);
            return false;
        }
    }

    return true;
}

// FUNCTIONS TO SUPPORT FILTERING BY PREVIOUS PERMUTATION

function filterSubgroupsByPreviousPermutation(tracker, assetPackSettings, previousIterationOutput, subgroupChoiceListPrimary, verboseReport, out_writeVerbose)
{
    Aux.logVerbose("\nAttempting to force the patcher to generate a different subgroup by subtracting one of the subgroups from a previously generated permutation:\n", verboseReport, out_writeVerbose);

    let numPossibleSeeds = Aux.getArrayUniquesByValue(subgroupChoiceListPrimary).length;

    if (tracker.chosenUniqueSeeds.length === numPossibleSeeds) // get rid of the current possibilities
    {
        Aux.logVerbose("\tAll possible seed subgroups from the current set of available subgroups have been tried. Attempting to remove a different subgroup from the available list.", verboseReport, out_writeVerbose);
        while (bSugroupHasAlreadyBeenRemoved(tracker, verboseReport, out_writeVerbose) === true)
        {
            tracker.chosenUniqueSeeds = [];

            // restore previously removed subgroup if it exists
            if (tracker.splicedSubgroupCoordinates.length > 0)
            {
                assetPackSettings[tracker.splicedSubgroupCoordinates[0]].flattenedSubgroups[tracker.splicedSubgroupCoordinates[1]].splice(tracker.splicedSubgroupCoordinates[2], 0, tracker.splicedSubgroup);
                Aux.logVerbose("\tRestoring previously removed subgroup " + tracker.splicedSubgroup.id + " to " + tracker.packToTrim.groupName, verboseReport, out_writeVerbose, verboseReport, out_writeVerbose);
            }

            // if the subgroup index to be removed (which was incremented during the previous iteration) is outside the bounds of the "current" previously generated permutation, move on the "next" previously generated permutation
            if (tracker.currentSubgroupIndex === previousIterationOutput.generatedPermutationSubgroups[tracker.currentPermutationIndex].length) 
            {
                tracker.currentSubgroupIndex = 0;
                tracker.currentPermutationIndex++;
                Aux.logVerbose("\tNo subgroups remain available to remove in asset pack " + tracker.packToTrim.groupName + ". Moving to the next asset pack.", verboseReport, out_writeVerbose);
            }
            // if there are no more previously generated permutations to operate on
            if (tracker.currentPermutationIndex === previousIterationOutput.generatedPermutationSubgroups.length)
            {
                Aux.logVerbose("\tNo asset packs from which subgroups can be subtracted remain. No more unique permutations can be generated.", verboseReport, out_writeVerbose);
                subgroupChoiceListPrimary.length = 0; // clears the array, signals the calling function to break out of its controlling loop.
                return false; // nothing more can be done to force the patcher to generate a different permutation than what has been generated before
            }

            // splice the selected subgroup from the currently available subgroups to force the patcher to generate a new permutation
            tracker.packToTrimIndex = Aux.getAssetPackIndexByName(previousIterationOutput.generatedPermutationAssetPacks[tracker.currentPermutationIndex], assetPackSettings);
            tracker.packToTrim = assetPackSettings[tracker.packToTrimIndex];
            tracker.subgroupIDtoTrim = previousIterationOutput.generatedPermutationSubgroups[tracker.currentPermutationIndex][tracker.currentSubgroupIndex];

            if (tracker.packToTrim.flattenedSubgroups[tracker.currentSubgroupIndex].length === 1)
            {
                Aux.logVerbose("\tCannot remove subgroup " + tracker.subgroupIDtoTrim + " from " + tracker.packToTrim.groupName + " because it is the only available subgroup at that position.", verboseReport, out_writeVerbose);
                tracker.currentSubgroupIndex++;
                continue;
            }
            else
            {
                Aux.logVerbose("\tRemoving subgroup " + tracker.subgroupIDtoTrim + " from " + tracker.packToTrim.groupName, verboseReport, out_writeVerbose);
                for (let z = 0; z < tracker.packToTrim.flattenedSubgroups[tracker.currentSubgroupIndex].length; z++)
                {
                    if (tracker.packToTrim.flattenedSubgroups[tracker.currentSubgroupIndex][z].id === tracker.subgroupIDtoTrim)
                    {
                        tracker.splicedSubgroupCoordinates = [tracker.packToTrimIndex, tracker.currentSubgroupIndex, z];
                        tracker.splicedSubgroup = tracker.packToTrim.flattenedSubgroups[tracker.currentSubgroupIndex].splice(z, 1)[0]; // [0] at the end because array.splice() returns an array, and splicedSubgroup is the sole array element
                    }
                }
                tracker.currentSubgroupIndex++;
            }
        }
    }
    else
    {
        Aux.logVerbose("\tTrying a different seed subgroup from the current set of available subgroups.", verboseReport, out_writeVerbose);
    }
    return true;
}

function bSugroupHasAlreadyBeenRemoved(tracker, verboseReport, out_writeVerbose)
{
    if (tracker.packToTrim === undefined) // if this is the first subgroup to be removed, enter the calling while loop.
    {
        return true;
    }

    for (let i = 0; i < tracker.previouslyRemovedSubgroups.length; i++)
    {
        if (tracker.packToTrim.groupName === tracker.previouslyRemovedSubgroups[i][0] && tracker.subgroupIDtoTrim === tracker.previouslyRemovedSubgroups[i][1])
        {
            Aux.logVerbose("This subgroup has already been removed when operating on another previously generated permutation, and all resulting new permutations have failed. Moving on to the next subgroup.", verboseReport, out_writeVerbose);
            return true;
        }
    }

    tracker.previouslyRemovedSubgroups.push([tracker.packToTrim.groupName, tracker.subgroupIDtoTrim]);
    return false;
}

function updateRemovedSubgroupTrackerUniqueSeeds(tracker, seedSubgroup)
{
    let bSeedFound = false;
    for (let z = 0; z < tracker.chosenUniqueSeeds.length; z++)
    {
        if (tracker.chosenUniqueSeeds[z][0] === seedSubgroup.id && tracker.chosenUniqueSeeds[z][1] === seedSubgroup.parentAssetPack)
        {
            bSeedFound = true;
            break;
        }
    }
    if (bSeedFound === false)
    {
        tracker.chosenUniqueSeeds.push([seedSubgroup.id, seedSubgroup.parentAssetPack]);
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

    // If any disallowedRaces from parent are present in subgroup's AllowedRaces, remove them
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

// CONSISTENCY HANDLING AND MISCELLANEOUS
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
        assignmentRecord.assignedAssetPack = chosenPermutation.sourceAssetPack;
        assignmentRecord.assignedPermutation = chosenPermutation.nameString; 
    }
}

// this function returns true if each of the user-forced subgroups are contained within the given permutation
function permutationAllowedByUserForceList(userForcedAssignment, permutation)
{
    if (userForcedAssignment === undefined)
    {
        return true;
    }

    if (userForcedAssignment.forcedAssetPack !== "")
    {
        if (permutation.sourceAssetPack !== userForcedAssignment.forcedAssetPack)
        {
            return false;
        }
        else if (userForcedAssignment.forcedSubgroups !== undefined && userForcedAssignment.forcedSubgroups.length > 0)
        {
            for (let i = 0; i < userForcedAssignment.forcedSubgroups.length; i++)
            {
                if (bPermutationContributingSubgroupIDsContain(permutation, userForcedAssignment.forcedSubgroups[i].id) === false)
                {
                    return false;
                }
            }
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

function linkPermutationToUniques(permutationToReturn, permutations)
{
    let bUnique = true;
    for (let i = 0; i < permutations.length; i++)
    {
        if (permutationToReturn.sourceAssetPack === permutations[i].sourceAssetPack && permutationToReturn.nameString === permutations[i].nameString)
        {
            permutationToReturn = permutations[i];
            bUnique = false;
        }
    }

    if (bUnique === true)
    {
        permutations.push(permutationToReturn);
    }
    
    return permutationToReturn;
}