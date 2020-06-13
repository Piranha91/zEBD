debugger;
let Aux = require('./Auxilliary.js');

module.exports = function(logDir, fh, modulePath)
    {
        let IO = {};
        let ErrorHandler = require ('./Errorhandler.js')(logDir, fh);
        let verboseLogPath = logDir + "\\VerboseLog.txt";
        let permutationBuildupLogPath = logDir + "\\PermutationBuildupLog.txt";

        IO.loadBodyGenConfig = function(modulePath)
        {
            let path_BodyGenConfig = modulePath + "\\NPC Configuration\\BodygenConfig.json";
            let cfg;

            try
            {
                cfg = fh.loadJsonFile(path_BodyGenConfig);
            } catch (e)
            {
            }

            return cfg;
        }

        IO.saveBodyGenConfig = function(bodyGenConfig)
        {
            let path = modulePath + "\\NPC Configuration\\BodygenConfig.json";

            try
            {
                fh.saveJsonFile(path, bodyGenConfig);
                alert("Body Configuration Saved");
            }
            catch (e)
                    {
                    }
        }

        IO.loadExtraBodyGenConfigs = function(modulePath, currentBodyGenConfig)
        {
            let path_ExtraConfigs = modulePath + "\\zEBD assets\\Bodygen Integration\\Import";
            let fs = require('fs');
            let files = fs.readdirSync(path_ExtraConfigs);
            
            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    this.loadSelectedBodyGenConfig(path_ExtraConfigs + "\\" + files[i], currentBodyGenConfig);
                }
            }
        }

        IO.loadSelectedBodyGenConfig = function(path, currentBodyGenConfig)
        {
            if (path === undefined)
            {
                return;
            }
            let bContains = false;
            let bSubContains = false;
            let obj = {};
            try
            {
                obj = fh.loadJsonFile(path);
                
                // import new racial settings

                if (obj.racialSettingsFemale !== undefined)
                {
                    for (let i = 0; i < obj.racialSettingsFemale.length; i++)
                    {
                        bContains = false;
                        for (let j = 0; j < currentBodyGenConfig.racialSettingsFemale.length; j++)
                        {
                            if (currentBodyGenConfig.racialSettingsFemale[j].EDID === obj.racialSettingsFemale[i].EDID)
                            {
                                for (let k = 0; k < obj.racialSettingsFemale[i].combinations.length; k++)
                                {
                                    bSubContains = false;
                                    for (let l = 0; l < currentBodyGenConfig.racialSettingsFemale[j].combinations.length; l++)
                                    {
                                        if (angular.equals(obj.racialSettingsFemale[i].combinations[k], currentBodyGenConfig.racialSettingsFemale[j].combinations[l]) === true)
                                        {
                                            bSubContains = true;
                                            break;
                                        }

                                        if (bSubContains === false)
                                        {
                                            currentBodyGenConfig.racialSettingsFemale[j].combinations.push(obj.racialSettingsFemale[i].combinations[k]);
                                        }
                                    }
                                }

                                bContains = true;
                                break;
                            }
                        }
                        
                        if (bContains === false)
                        {
                            currentBodyGenConfig.racialSettingsFemale.push(obj.racialSettingsFemale[i]);
                        }
                    }
                }

                if (obj.racialSettingsMale !== undefined)
                {
                    for (let i = 0; i < obj.racialSettingsMale.length; i++)
                    {
                        bContains = false;
                        for (let j = 0; j < currentBodyGenConfig.racialSettingsMale.length; j++)
                        {
                            if (currentBodyGenConfig.racialSettingsMale[j].EDID === obj.racialSettingsMale[i].EDID)
                            {
                                bContains = true;
                                break;
                            }
                        }
                        
                        if (bContains === false)
                        {
                            currentBodyGenConfig.racialSettingsMale.push(obj.racialSettingsMale[i]);
                        }
                    }
                }

                if (obj.templates !== undefined)
                {
                    for (let i = 0; i < obj.templates.length; i++)
                    {
                        bContains = false;
                        for (let j = 0; j < currentBodyGenConfig.templates.length; j++)
                        {
                            if (currentBodyGenConfig.templates[j].name === obj.templates[i].name)
                            {
                                bContains = true;
                                break;
                            }
                        }
                        
                        if (bContains === false)
                        {
                            currentBodyGenConfig.templates.push(obj.templates[i]);
                        }
                    }
                }

                if (obj.templateGroups !== undefined)
                {
                    for (let i = 0; i < obj.templateGroups.length; i++)
                    {
                        bContains = false;
                        for (let j = 0; j < currentBodyGenConfig.templateGroups.length; j++)
                        {
                            if (currentBodyGenConfig.templateGroups[j] === obj.templateGroups[i])
                            {
                                bContains = true;
                                break;
                            }
                        }
                        
                        if (bContains === false)
                        {
                            currentBodyGenConfig.templateGroups.push(obj.templateGroups[i]);
                        }
                    }
                }

                if (obj.templateDescriptors !== undefined)
                {
                    for (let i = 0; i < obj.templateDescriptors.length; i++)
                    {
                        bContains = false;
                        for (let j = 0; j < currentBodyGenConfig.templateDescriptors.length; j++)
                        {
                            if (currentBodyGenConfig.templateDescriptors[j] === obj.templateDescriptors[i])
                            {
                                bContains = true;
                                break;
                            }
                        }
                        
                        if (bContains === false)
                        {
                            currentBodyGenConfig.templateDescriptors.push(obj.templateDescriptors[i]);
                        }
                    }
                }

            } catch (e)
            {
            }
        }

        IO.loadNewBodyGenTemplates = function(modulePath, existingTemplates)
        {
            let path_Templates = modulePath + "\\zEBD assets\\Bodygen Integration\\Templates";
            let fs = require('fs');
            let files = fs.readdirSync(path_Templates);

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "ini")
                {
                    this.loadSelectedBodyGenTemplate(path_Templates + "\\" + files[i], existingTemplates);
                }
            }
        }

        IO.loadSelectedBodyGenTemplate = function (path, existingTemplates)
        {
            let input = "";
            let split;
            let split2;
            let currentName = "";
            let currentPreset = "";
            let bAddTemplate = true;
            let newTemplate = {};

            if (path === undefined)
            {
                return;
            }

            try
            {
                input = fh.loadTextFile(path);
                split = input.split(/\r?\n/);
                for (let i = 0; i < split.length; i++)
                {
                    split2 = split[i].split('=');
                    bAddTemplate = true;
                    if (split2.length === 2)
                    {
                        currentName = split2[0].trim();
                        currentPreset = split2[1].trim();
                        // check to make sure that the current template doesn't already exist
                        for (let j = 0; j < existingTemplates.length; j++)
                        {
                            if (existingTemplates[j].name === currentName)
                            {
                                bAddTemplate = false;
                                break;
                            }
                        }

                        if (bAddTemplate === true)
                        {
                            newTemplate = Aux.createBodyGenTemplate(currentName, currentPreset);
                            existingTemplates.push(newTemplate)
                        }
                    }
                }
            } catch (e)
            {
            }
        }

        IO.loadHeightPresets = function(modulePath)
        {
            let path_HeightPresets = modulePath + "\\zEBD assets\\Height Presets";
            let presets = [];
            let fs = require('fs');
            let files = fs.readdirSync(path_HeightPresets);
            let obj = {};

            for (let i = 0; i < files.length; i++)
            {
                obj = {};
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        obj.name = files[i].split('.')[0];
                        obj.presets = fh.loadJsonFile(path_HeightPresets + "\\" + files[i]);
                        presets.push(obj);
                    } catch (e)
                    {
                    }
                }
            }
            return presets;
        }

        IO.loadHeightConfiguration = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\HeightConfig.json";

            let heightConfig = [];
            try
            {
                heightConfig = fh.loadJsonFile(path);
            }
            catch (e)
                    {
                    }

            return heightConfig;
        }

        IO.saveHeightConfiguration = function(modulePath, heightConfig)
        {
            let path = modulePath + "\\NPC Configuration\\HeightConfig.json";

            try
            {
                fh.saveJsonFile(path, heightConfig);
                alert("Height Configuration Saved");
            }
            catch (e)
                    {
                    }
        }
        
        IO.loadAssetPackSettings = function(modulePath, bDisplayAlerts, userKeywords, bThrowErrorIfFail, bValidateConfigs, bAbortIfPathWarnings)
        {
            let path_packSettingsDir = modulePath + "\\zEBD Assets\\Asset Pack Settings";
            let packSettingsArray = [];
            let fs = require('fs');
            let files = fs.readdirSync(path_packSettingsDir);
            let bParsedSuccssfully = true;
            let bErrorEncountered = false;
            let currentPackSettings = undefined;
            let pathWarnings = [];

            for (let i = 0; i < files.length; i++)
            {
                bParsedSuccssfully = true;
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        currentPackSettings = fh.loadJsonFile(path_packSettingsDir + "\\" + files[i]);
                    } catch (e)
                    {
                        if (bThrowErrorIfFail === true)
                        {
                            throw new Error("Settings file " + files[i] + " has an error. Patching aborted.");
                        }

                        bParsedSuccssfully = false;
                        bErrorEncountered = true;
                        ErrorHandler.logError("Asset Pack Settings loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.")
                        continue;
                    }

                    if (bValidateConfigs === true)
                    {
                        bParsedSuccssfully = IO.validatePackSettings(currentPackSettings, bDisplayAlerts, bParsedSuccssfully, pathWarnings, userKeywords);

                        if (bAbortIfPathWarnings === true && pathWarnings.length > 0)
                        {
                            throw new Error("Assets expected by Settings file " + files[i] + " were not found. Please validate this config file from the settings menu. Patching aborted.");
                        }
                    }

                    if (bParsedSuccssfully === true)
                    {
                        currentPackSettings.sourcePath = path_packSettingsDir + "\\" + files[i];
                        packSettingsArray.push(currentPackSettings);
                    }
                    else if (bValidateConfigs === true)
                    {
                        bErrorEncountered = true;
                    }
                }
            }

            IO.warnUserAboutPaths(pathWarnings);

            if (bErrorEncountered === true)
            {
                ErrorHandler.alertError("An error occured during Asset Pack Settings loading.");
            }

            userKeywords = Aux.getArrayUniques(userKeywords);

            return packSettingsArray;
        };

        IO.warnUserAboutPaths = function (pathWarnings)
        {
            let pathWarningsAlert = "";

            if (pathWarnings.length > 0)
            {
                for (let i = 0; i < pathWarnings.length; i++)
                {
                    pathWarningsAlert = pathWarningsAlert + pathWarnings[i] + "\n\n";
                }
                alert(pathWarningsAlert);
            }
        }

        IO.saveAssetPackSettings = function (currentPackSettings, modulePath)
        {
            let path_AssetPackSettings = modulePath + "\\zEBD Assets\\Asset Pack Settings";
            let savePath;
            let bak_sourcePath;

            if (currentPackSettings.sourcePath === undefined)
            {
                savePath = path_AssetPackSettings + "\\" + currentPackSettings.groupName + ".json";
            }
            else
            {
                savePath = currentPackSettings.sourcePath;
                bak_sourcePath = currentPackSettings.sourcePath;
                delete currentPackSettings.sourcePath; // to avoid accidentally writing personal user info (file path) into the saved config file.
            }

            try
            {
                fh.saveJsonFile(savePath, currentPackSettings);
                alert("Saved: " + savePath);
            } catch (e)
            {
                alert("Settings file " + savePath + " could not be saved. If this is a new file, make sure that the Group Name contains valid filename characters.\n\nError: "+ e);
            }

            currentPackSettings.sourcePath = bak_sourcePath; // restore the sourece path.
        };

        IO.loadRestrictionGroupDefs =  function (modulePath, bDisplayAlerts)
        {
            let path_restrictionDir = modulePath + "\\zEBD Assets\\RestrictionDefs";
            let bParsedSuccessfully = true;
            let restrictionArray = [];
            let fs = require('fs');
            let files = fs.readdirSync(path_restrictionDir);
            let bExists = false;

            let currentRestrictionGroupSettings = undefined;

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        currentRestrictionGroupSettings = fh.loadJsonFile(path_restrictionDir + "\\" + files[i]);
                    } catch (e)
                    {
                        bParsedSuccessfully = false;
                        ErrorHandler.logError("Race Group Definition Settings loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.", fh)
                        continue;
                    }

                    let bParsedSuccssfully = validateGroupDefinitionSettings(currentRestrictionGroupSettings, bDisplayAlerts, files[i], bParsedSuccessfully);
                    if (bParsedSuccssfully === true)
                    {
                        for (let j = 0; j < currentRestrictionGroupSettings.length; j++)
                        {
                            bExists = false;
                            for (let k = 0; k < restrictionArray.length; k++)
                            {
                                if (currentRestrictionGroupSettings[j].name === restrictionArray[k].name)
                                {
                                    bExists = true;
                                    break;
                                }
                            }

                            if (bExists === false)
                            {
                                restrictionArray.push(currentRestrictionGroupSettings[j]);
                            }
                        }
                    } // don't push or each json file will become its own array
                    else
                    {
                        ErrorHandler.alertError("An error occured during Race Group Definition Settings interpretation.");
                    }

                }
            }

            if (bParsedSuccessfully === false)
            {
                ErrorHandler.alertError("An error occured during Race Group Definition Settings loading.");
            }

            return restrictionArray;
        };

        IO.saveRestrictionGroupDefs = function(groupDefs)
        {
            let path_restrictionOR = modulePath + "\\zEBD Assets\\RestrictionDefs\\userCustom.json";
            try
            {
                fh.saveJsonFile(path_restrictionOR, groupDefs);
                alert("Group settings saved.")
            }
            catch (e)
            {

            }
        }

        IO.generatePermutationLog = function (permutationHolders, logDir)
        {
            let RG = require(modulePath + '\\lib\\RecordGenerator.js')(logDir, fh);

            let writePath = logDir + "\\PermutationsGenerated.txt";
            let writeStrings = "";
            let writeString = "";
            let permIndex = 0;
            let subRecords = [];

                for (let i = 0; i < permutationHolders.length; i++)
                {
                    permIndex++;
                    writeString = permIndex + ": " + permutationHolders[i].nameString + " (gender: " + permutationHolders[i].gender + ") from: " + permutationHolders[i].assetPackSettingsGeneratedFrom;
                    writeString += "\n\tDistribution enabled: " + permutationHolders[i].distributionEnabled + " (to unique NPCs: " + permutationHolders[i].allowUnique + "), (to non-unique NPCs: " + permutationHolders[i].allowNonUnique + ")";
                    writeStrings += writeString + "\n";
                    writeString = "\tPermutation probability weighting: " + permutationHolders[i].probabilityWeighting.toString();
                    writeStrings += writeString + "\n";
                    writeString = "\tContents: ";
                    for (let j = 0; j < permutationHolders[i].contributingSubgroupIDs.length; j++)
                    {
                        writeString += permutationHolders[i].contributingSubgroupIDs[j] + " (" + permutationHolders[i].contributingSubgroupNames[j] + ")";
                        if (j < permutationHolders[i].contributingSubgroupIDs.length - 1)
                        {
                            writeString += ", ";
                        }
                    }
                    writeStrings += writeString + "\n";

                    if (permutationHolders[i].allowedRaces != undefined && permutationHolders[i].allowedRaces.length > 0)
                    {
                        writeString = "\tAllowed Races: ";
                        for (let j = 0; j < permutationHolders[i].allowedRaces.length; j++)
                        {
                            writeString += permutationHolders[i].allowedRaces[j];
                            if (j < permutationHolders[i].allowedRaces.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].disallowedRaces != undefined && permutationHolders[i].disallowedRaces.length > 0)
                    {
                        writeString = "\tDisallowed Races: ";
                        for (let j = 0; j < permutationHolders[i].disallowedRaces.length; j++)
                        {
                            writeString += permutationHolders[i].disallowedRaces[j];
                            if (j < permutationHolders[i].disallowedRaces.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].allowedAttributes != undefined && permutationHolders[i].allowedAttributes.length > 0)
                    {
                        writeString = "\tAllowed Attributes: ";
                        for (let j = 0; j < permutationHolders[i].allowedAttributes.length; j++)
                        {
                            writeString += "(" + permutationHolders[i].allowedAttributes[j].attribute[0] + "," + permutationHolders[i].allowedAttributes[j].attribute[1] + ")";
                            if (j < permutationHolders[i].allowedAttributes.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].disallowedAttributes != undefined && permutationHolders[i].disallowedAttributes.length > 0)
                    {
                        writeString = "\tDisallowed Attributes: ";
                        for (let j = 0; j < permutationHolders[i].disallowedAttributes.length; j++)
                        {
                            writeString += "(" + permutationHolders[i].disallowedAttributes[j].attribute[0] + "," + permutationHolders[i].disallowedAttributes[j].attribute[1] + ")";
                            if (j < permutationHolders[i].disallowedAttributes.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].forceIfAttributes != undefined && permutationHolders[i].forceIfAttributes.length > 0)
                    {
                        writeString = "\tForceIf Attributes: ";
                        for (let j = 0; j < permutationHolders[i].forceIfAttributes.length; j++)
                        {
                            writeString += "(" + permutationHolders[i].forceIfAttributes[j].attribute[0] + "," + permutationHolders[i].forceIfAttributes[j].attribute[1] + ")";
                            if (j < permutationHolders[i].forceIfAttributes.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].requiredSubgroups != undefined && permutationHolders[i].requiredSubgroups.length > 0)
                    {
                        writeString = "\tRequired Subgroups: ";
                        for (let j = 0; j < permutationHolders[i].requiredSubgroups.length; j++)
                        {
                            writeString += permutationHolders[i].requiredSubgroups[j];
                            if (j < permutationHolders[i].requiredSubgroups.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].allowedSubgroups != undefined && permutationHolders[i].allowedSubgroups.length > 0)
                    {
                        writeString = "\tAllowed Subgroups: ";
                        for (let j = 0; j < permutationHolders[i].allowedSubgroups.length; j++)
                        {
                            writeString += permutationHolders[i].allowedSubgroups[j];
                            if (j < permutationHolders[i].allowedSubgroups.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].excludedSubgroups != undefined && permutationHolders[i].excludedSubgroups.length > 0)
                    {
                        writeString = "\tExcluded Subgroups: ";
                        for (let j = 0; j < permutationHolders[i].excludedSubgroups.length; j++)
                        {
                            writeString += permutationHolders[i].excludedSubgroups[j];
                            if (j < permutationHolders[i].excludedSubgroups.length - 1)
                            {
                                writeString += ",";
                            }
                        }
                        writeStrings += writeString + "\n";
                    }

                    if (permutationHolders[i].paths != undefined && permutationHolders[i].paths.length > 0)
                    {
                        writeString = "\tFilepaths: \n";
                        for (let j = 0; j < permutationHolders[i].paths.length; j++)
                        {
                            writeString += "\t\t" + permutationHolders[i].paths[j][0] + "\n";

                        }
                        writeStrings += writeString;
                    }

                    if (permutationHolders[i].templates != undefined && permutationHolders[i].templates.length > 0)
                    {
                        writeString = "\tGenerated Records: \n";
                        for (let j = 0; j < permutationHolders[i].templates.length; j++)
                        {
                            // get subRecords
                            subRecords = [];
                            RG.collectGeneratedzEBDrecords(permutationHolders[i].templates[j], subRecords);
                            for (let k = 0; k < subRecords.length; k++)
                            {
                                writeString += "\t\t" + subRecords[k].EDID + " [" + subRecords[k].zEBDSignature + "]: " + subRecords[k].zEBDformID + "\n";
                            }
                        }
                        writeStrings += writeString;
                    }
                    writeStrings += "\n";

                    if (permutationHolders[i].NPCsAssignedTo != undefined && permutationHolders[i].NPCsAssignedTo.length > 0)
                    {
                        writeString = "\tAssigned to the following NPCs:\n"
                        for (let j = 0; j < permutationHolders[i].NPCsAssignedTo.length; j++)
                        {
                            writeString += "\t\t" + permutationHolders[i].NPCsAssignedTo[j] + "\n";
                        }
                        writeStrings += writeString;
                    }
                    writeStrings += "\n";
                }

            try
            {
                fh.saveTextFile(writePath, writeStrings);
            } catch (e)
            {
                alert("Error: could not write permutation log file at " + writePath);
            }
        };

        IO.validatePackSettings = function(currentPackSettings, bDisplayAlerts, bParsedSuccessfully, pathWarnings, userKeywords)
        {
            let subgroupHierarchy = {};
            subgroupHierarchy.id = "top";
            subgroupHierarchy.subgroups = currentPackSettings.subgroups;

            // check that currentPackSettings loaded from JSON file has all expected members. Warn users otherwise.

            let packSettingsName = "Package Settings Name was not defined."

            // check for group name
            if (currentPackSettings.groupName === undefined)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName, "The \"groupName\" field must be set so that this settings pack has a name");
            }
            else { packSettingsName = currentPackSettings.groupName;}

            // check for gender
            if (currentPackSettings.gender === undefined)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName, "Pack must have a gender (M/m/F/f) assigned to it.");
            }
            else
            {
                let gender = currentPackSettings.gender.toLowerCase();
                if (gender != "m" && gender != "f" && gender != "male" && gender != "female")
                {
                    bParsedSuccessfully = false;
                    ErrorHandler.logError("Interpretation of package settings " + packSettingsName, "Gender must be \"M\" or \"F\"");
                }
            }

            // check for alerts
            if (currentPackSettings.displayAssetPackAlerts === undefined)
            {
                currentPackSettings.displayAssetPackAlerts = true;
            }
            if (currentPackSettings.displayAssetPackAlerts === true && currentPackSettings.userAlert != undefined && currentPackSettings.userAlert.length > 0 && bDisplayAlerts === true)
            {
                alert("Alert from " + packSettingsName + ":\n" + currentPackSettings.userAlert);
            }

            // validate subgroups
            if (currentPackSettings.subgroups === undefined)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName, "Package settings must have at least one subgroup defined, or have an empty array");
            }
            else
            {
                for (let i = 0; i < currentPackSettings.subgroups.length; i++)
                {
                    bParsedSuccessfully = validatesubgroupSettings(currentPackSettings.subgroups[i], bParsedSuccessfully, packSettingsName + "\\" + currentPackSettings.subgroups[i].id, ErrorHandler, fh, pathWarnings, [], userKeywords, subgroupHierarchy);
                }
            }

            return bParsedSuccessfully;
        };

        IO.logVerbose = function(inputString, bWriteToFile)
        {
            if (bWriteToFile === undefined || bWriteToFile === false)
            {
                verboseLogString += inputString + "\n";
            }

            else
            {
               try
                {
                    fh.saveTextFile(verboseLogPath, verboseLogString);
                } catch (e)
                {
                    alert("Error: could not write verbose log file at " + verboseLogPath);
                }
            }
        };

        IO.logPermutationBuildup = function(permutations, bWriteToFile, headerString)
        {
            if (headerString !== undefined)
            {
                permutationBuildupLogString += "Permutations from: " + headerString + "\n\n";
                return;
            }

            if ((bWriteToFile === undefined || bWriteToFile === false) && permutations != undefined)
            {
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
                permutationBuildupLogString += "\n";
            }

            else
            {
                try
                {
                    fh.saveTextFile(permutationBuildupLogPath, permutationBuildupLogString);
                } catch (e)
                {
                    alert("Error: could not write permutation buildup log file at " + permutationBuildupLogPath);
                }
            }
        };

        IO.loadRecordTemplates = function(modulePath, groupDefs)
        {
            let path_RecordTemplates = modulePath + "\\zEBD Assets\\RecordTemplates";
            let recordTemplateArray = [];
            let fs = require('fs');
            let files = fs.readdirSync(path_RecordTemplates);
            let bParsedSuccssfully = true;
            let currentRecordTemplate = undefined;

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        currentRecordTemplate = fh.loadJsonFile(path_RecordTemplates + "\\" + files[i]);
                    } catch (e)
                    {
                        bParsedSuccssfully = false;
                        ErrorHandler.logError("Record Template loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.")
                        continue;
                    }

                    bParsedSuccssfully = true; // TEMPORARY
                    // CALL A PARSING FUNCTION LATER WHEN I HAVE A BETTER SENSE OF WHICH EXCEPTIONS MUST BE HANDLED

                    if (bParsedSuccssfully === true)
                    {
                        for (let j = 0; j < currentRecordTemplate.records.length; j++)
                        {
                            if (Array.isArray(currentRecordTemplate.records[j].zEBDsupportedRaces) === true)
                            {
                                currentRecordTemplate.records[j].zEBDsupportedRaces = Aux.replaceGroupDefWithIndividuals(currentRecordTemplate.records[j].zEBDsupportedRaces, groupDefs);
                            }
                            else
                            {
                                currentRecordTemplate.records[j].zEBDsupportedRaces = Aux.replaceGroupDefWithIndividuals([currentRecordTemplate.records[j].zEBDsupportedRaces], groupDefs);
                            }

                            Aux.getArrayUniques(currentRecordTemplate.records[j].zEBDsupportedRaces);
                            recordTemplateArray.push(currentRecordTemplate.records[j]);
                        }
                    }
                }
            }

            if (bParsedSuccssfully === false)
            {
                ErrorHandler.alertError("An error occured during Asset Pack Settings loading.");
            }

            return recordTemplateArray;
        };

        IO.loadTrimPaths = function(modulePath) // STILL NEED TO WRITE A VALIDATION FUNCTION FOR THIS MODULE
        {
            let trimPathArray = [];
            let trimPathsFromFile;
            let bParsedSuccssfully = true;
            let path_TrimPathDir = modulePath + "\\zEBD Assets\\MiscConfig";
            let fs = require('fs');
            let files = fs.readdirSync(path_TrimPathDir);

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json" && files[i].indexOf("TrimPaths") === 0) // only load files prefixed with "TrimPaths"
                {
                    try
                    {
                        trimPathsFromFile = fh.loadJsonFile(path_TrimPathDir + "\\" + files[i]);
                        for (let j = 0; j < trimPathsFromFile.length; j++)
                        {
                            updateTrimPaths(trimPathArray, trimPathsFromFile[j]);
                        }

                    } catch (e)
                    {
                        ErrorHandler.logError("TrimPath Settings loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.")
                        bParsedSuccssfully = false;
                        continue;
                    }

                }
            }

            if (bParsedSuccssfully === false)
            {
                ErrorHandler.alertError("An error occured during Asset Pack Settings loading.");
            }
            return trimPathArray;
        };

        IO.loadEBDAssets = function(modulePath)
        {
            let EBDAssetArray = [];
            let EBDAssetsFromFile;
            let bParsedSuccssfully = true;
            let path_EBDAssetDir = modulePath + "\\zEBD Assets\\EBD Records";
            let fs = require('fs');
            let files = fs.readdirSync(path_EBDAssetDir);

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        EBDAssetsFromFile = fh.loadJsonFile(path_EBDAssetDir + "\\" + files[i]);

                        EBDAssetArray.push(EBDAssetsFromFile);
                    } catch (e)
                    {
                        ErrorHandler.logError("EBDAssets loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.")
                        bParsedSuccssfully = false;
                        continue;
                    }

                }
            }

            if (bParsedSuccssfully === false)
            {
                ErrorHandler.alertError("An error occured during Asset Pack Settings loading.");
            }

            return EBDAssetArray;
        };

        IO.loadConsistency = function(modulePath, bEnableConsistency)
        {
            let path = modulePath + "\\NPC Configuration\\Consistency.json";
            let consistency;

            if (bEnableConsistency === true)
            {
                consistency = fh.loadJsonFile(path);
            }

            if (consistency === undefined) // consistency file deleted or not yet generated
            {
                consistency = [];
            }

            return consistency;
        };

        IO.saveConsistency = function (modulePath, NPCAssignments)
        {
            let path = modulePath + "\\NPC Configuration\\Consistency.json";

            // remove the "forced" sections from the NPCassignments to avoid unintentional carryover
            for (let i = 0; i < NPCAssignments.length; i++)
            {
                delete NPCAssignments[i].forcedAssetPack;
                delete NPCAssignments[i].forcedSubgroups;
            }

            try
            {
                fh.saveJsonFile(path, NPCAssignments);
            } catch (e)
            {
                alert("Error: Could not save the consistency file at:\n " + path);
            }
        };

        IO.deleteConsistency = function(modulePath)
        {
            let consistencyPath = modulePath + "\\NPC Configuration\\Consistency.json";
            let currentDate = new Date(); // initialized with current timestamp
            let dateString = currentDate.toUTCString();
            dateString = dateString.replace(new RegExp(':', 'g'), '-');
            let moveTo = consistencyPath.split('.').slice(0, -1).join('.') + "_" + dateString + ".json.bak"; // backup path is previous path without file extension + datestring + .json.bak

            if (fh.jetpack.exists(consistencyPath) === "file")
            {
                fh.jetpack.move(consistencyPath, moveTo);
            }
        };

        IO.loadBlockList = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\BlockList.json";
            let blockList = fh.loadJsonFile(path);


            if (blockList === undefined)
            {
                blockList = [];
            }

            if (blockList.blockedNPCs === undefined)
            {
                blockList.blockedNPCs = [];
            }
            if (blockList.blockedPlugins === undefined)
            {
                blockList.blockedPlugins = [];
            }

            return blockList;
        };

        IO.loadForceList = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\ForceNPCList.json";
            let forceList = fh.loadJsonFile(path);

            if (forceList === undefined)
            {
                forceList = [];
            }

            for (let i = 0; i < forceList.length; i++)
            {
                for (let j = 0; j < forceList[i].forcedSubgroups.length; j++)
                {
                    if (forceList[i].forcedSubgroups[j].$$hashKey !== undefined)
                    {
                        delete forceList[i].forcedSubgroups[j].$$hashKey;
                    }
                }
            }

            return forceList;
        };

        IO.saveForceList = function(modulePath, forceList)
        {
            let path = modulePath + "\\NPC Configuration\\ForceNPCList.json";
            try
            {
                fh.saveJsonFile(path, forceList);
                alert("Force List Saved");
            }
            catch (e)
            {

            }
        }

        IO.saveBlockList = function(modulePath, blockList)
        {
            let path = modulePath + "\\NPC Configuration\\BlockList.json";
            try
            {
                fh.saveJsonFile(path, blockList);
                alert("Block List Saved");
            }
            catch (e)
            {

            }
        }

        IO.loadJason = function(modulePath)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\jason.json";

            let jason;

            try 
            {
                jason = fh.loadJsonFile(path);
            }
            catch{
                jason = undefined;
            }

            return jason;
        }

        IO.loadLinkedNPCNameExclusions = function(modulePath)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\LinkedNPCNameExclusions.json";

            let exclusions;

            try 
            {
                exclusions = fh.loadJsonFile(path);
            }
            catch{
                exclusions = [];
            }

            return exclusions;
        }

        IO.saveNPCLinkageExclusions = function(modulePath, exclusions)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\LinkedNPCNameExclusions.json";

            try 
            {
                fh.saveJsonFile(path, exclusions);
                alert("Exclusion List Saved");
            }
            catch (e)
            {

            }
        }

        IO.deleteSavedPermutationsRecords = function(modulePath)
        {
            let files = "";
            if (fh.jetpack.exists(modulePath + "\\NPC Configuration\\GeneratedPermutations.json") === "file")
            {
                try
                {
                    fh.jetpack.remove(modulePath + "\\NPC Configuration\\GeneratedPermutations.json");
                    files += "GeneratedPermutations.json\n";
                }
                catch(e)
                {

                }
            }
            if (fh.jetpack.exists(modulePath + "\\NPC Configuration\\GeneratedRecords.json") === "file")
            {
                try
                {
                    fh.jetpack.remove(modulePath + "\\NPC Configuration\\GeneratedRecords.json");
                    files += "GeneratedRecords.json\n";
                }
                catch(e)
                {

                }
            }
            if (fh.jetpack.exists(modulePath + "\\NPC Configuration\\GeneratedLinkageList.json") === "file")
            {
                try
                {
                    fh.jetpack.remove(modulePath + "\\NPC Configuration\\GeneratedLinkageList.json");
                    files += "GeneratedLinkageList.json\n";
                }
                catch(e)
                {

                }
            }
            if (fh.jetpack.exists(modulePath + "\\NPC Configuration\\GeneratedRecordsMaxPriority.json") === "file")
            {
                try
                {
                    fh.jetpack.remove(modulePath + "\\NPC Configuration\\GeneratedRecordsMaxPriority.json");
                    files += "GeneratedRecordsMaxPriority.json\n";
                }
                catch(e)
                {

                }
            }

            if (files.length > 0)
            {
                alert("Deleted saved permutations at:\n" + files);
            }
            else
            {
                alert("Could not find any saved permutations.")
            }
        }

        IO.saveGeneratedPermutations = function(modulePath, permutations)
        {
            let path = modulePath + "\\NPC Configuration\\GeneratedPermutations.json";

            fh.saveJsonFile(path, permutations);
        }

        IO.saveGeneratedRecords = function(modulePath, recordTemplates, linkageList, maxPriority)
        {
            let path = modulePath + "\\NPC Configuration\\GeneratedRecords.json";

            let linkagePath = modulePath + "\\NPC Configuration\\GeneratedLinkageList.json";

            let priorityPath = modulePath + "\\NPC Configuration\\GeneratedRecordsMaxPriority.json";

            fh.saveJsonFile(path, recordTemplates);
            fh.saveJsonFile(linkagePath, linkageList);

            let obj = {};
            obj.maxPriority = maxPriority;

            fh.saveJsonFile(priorityPath, obj);
        }

        IO.loadGeneratedRecords = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\GeneratedRecords.json";
            let recordTemplates = fh.loadJsonFile(path);

            if (recordTemplates === undefined || recordTemplates.length === 0)
            {
                alert("No records could be loaded from " + path + ". Generating records from settings instead.");
            }

            let linkagePath = modulePath + "\\NPC Configuration\\GeneratedLinkageList.json";
            let linkageList = fh.loadJsonFile(linkagePath);
            if (linkageList === undefined || linkageList.length === 0)
            {
                alert("Linkages could not be loaded from " + linkagePath + ". Generating records from settings instead.");
            }
            else
            {
                let elementName;
                let indexInList;
                let indexInArray;
                for (let i = 0; i < linkageList.length; i++)
                {
                    for (let j = 0; j < linkageList[i].length; j++)
                    {
                        elementName = linkageList[i][j][0];

                        switch(linkageList[i][j].length)
                        {
                            case 2:
                                indexInList = linkageList[i][j][1];
                                recordTemplates[i][elementName] = recordTemplates[indexInList];
                                break;
                            case 3:
                                indexInArray = linkageList[i][j][1];
                                indexInList = linkageList[i][j][2];
                                recordTemplates[i][elementName][indexInArray] = recordTemplates[indexInList];
                                break;
                            default: break;
                        }
                    }
                }
            }

            return recordTemplates;
        }

        IO.loadGeneratedPermutations = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\GeneratedPermutations.json";
            let permutations = fh.loadJsonFile(path);

            if (permutations === undefined || permutations.length === 0)
            {
                alert("No permutations could be loaded from " + path + ". Generating permutations from settings instead.");
            }

            return permutations;
        }

        IO.loadGeneratedRecordsMaxPriority = function(modulePath)
        {
            let path = modulePath + "\\NPC Configuration\\GeneratedRecordsMaxPriority.json";
            let obj = fh.loadJsonFile(path);

            if (obj === undefined)
            {
                alert("Max priority could be loaded from " + path + ". Generating records from settings instead.");
            }
            else
            {
                return obj.maxPriority;
            }
        }

        IO.generateBodyGenMorphs = function(assignments, templates, dataPath, patchFileName)
        {
            let writeString = "";
            let assignment;

            let path = dataPath + "meshes\\actors\\character\\BodyGenData\\" + patchFileName + "\\morphs.ini";

            for (let formID in assignments)
            {
                assignment = assignments[formID];
                if (assignment === undefined) { continue; }
                writeString += assignment.rootPlugin + "|" + assignment.ID + "=";

                for (let i = 0; i < assignment.morphs.length; i++)
                {
                    writeString += assignment.morphs[i];
                    if (i < assignment.morphs.length - 1)
                    {
                        writeString += ",";
                    }
                }
                writeString += "\n";
            }

            try
            {
                fh.saveTextFile(path, writeString);
            }
            catch (e)
            {

            }


            writeString = "";
            path = dataPath + "meshes\\actors\\character\\BodyGenData\\" + patchFileName + "\\templates.ini";

            for (let i = 0; i < templates.length; i++)
            {
                writeString += templates[i].name + "=" + templates[i].params + "\n";
            }

            try
            {
                fh.saveTextFile(path, writeString);
            }
            catch (e)
            {

            }
        }

        IO.setRaceMenuConfig = function(gameDataPath)
        {
            let path = gameDataPath + "SKSE\\plugins\\skee64.ini";
            let inFileString = "";
            let inFileLines = [];
            let writeString = "";
            let check1 = false;
            let check2 = false;
            let check3 = false;
            let check4 = false;
            let alertString = "";

            if (fh.jetpack.exists(path) === "file")
            {
                inFileString = fh.loadTextFile(path);
                inFileLines = inFileString.split(/\r?\n/);

                for (let i = 0; i < inFileLines.length; i++)
                {
                    if (inFileLines[i].trim().indexOf("iScaleMode") === 0)
                    {
                        inFileLines[i] = "iScaleMode=2";
                        check1 = true;
                        alertString += "Set iScaleMode=2 \n";
                    }
                    else if (inFileLines[i].trim().indexOf("iBodyMorphMode") === 0)
                    {
                        inFileLines[i] = "iBodyMorphMode=2";
                        check2 = true;
                        alertString += "Set iBodyMorphMode=2 \n"
                    }
                    else if (inFileLines[i].trim().indexOf("bEnableBodyMorph") === 0)
                    {
                        inFileLines[i] = "bEnableBodyMorph=1";
                        check3 = true;
                        alertString += "Set bEnableBodyMorph=1 \n"
                    }
                    else if (inFileLines[i].trim().indexOf("bEnableBodyGen") === 0)
                    {
                        inFileLines[i] = "bEnableBodyGen=1 ; Default[1]";
                        check4 = true;
                        alertString += "Set bEnableBodyGen=1 \n"
                    }

                    writeString += inFileLines[i] + "\n";
                }

                if (check3 === false)
                {
                    alertString += "Could not find line \"bEnableBodyMorph\" in the ini file. Make sure you're using the latest version of RaceMenu\n";
                } 
                if (check4 === false)
                {
                    alertString += "Could not find line \"bEnableBodyGen\" in the ini file. Make sure you're using the latest version of RaceMenu.\n";
                } 
                if (check1 === false)
                {
                    alertString += "Could not find line \"iScaleMode\" in the ini file. Make sure you're using the latest version of RaceMenu.\n";
                } 
                if (check2 === false)
                {
                    alertString += "Could not find line \"iBodyMorphMode\" in the ini file. Make sure you're using the latest version of RaceMenu.\n";
                } 
                if (check1 === true && check2 === true && check3 === true && check4 === true)
                {
                    alertString += "Make sure you have body morphs with zeroed sliders installed and you're good to go.";
                }

                try
                    {
                        fh.saveTextFile(path, writeString);
                        alert(alertString);
                    }
                    catch (e)
                    {
                        alert("Could not write to " + path);
                    }
            }
            else
            {
                alert("Could not find " + path + "\nMake sure that RaceMenu is installed.")
            }
        }

        IO.saveTrimPaths = function(modulePath, trimPaths)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\TrimPaths_Custom.json";

            fh.saveJsonFile(path, trimPaths);

            alert("Trim paths saved.");
        }

        return IO;
    };

function validatesubgroupSettings(currentsubgroup, bParsedSuccessfully, packSettingsName, ErrorHandler, fh, pathWarnings, IDs, userKeywords, subgroupHierarchy)
{
    let fullPath = "";
    
    //validate id
    if (currentsubgroup.id === undefined || currentsubgroup.id.trim() === "")
    {
        bParsedSuccessfully = false;
        ErrorHandler.logError("Interpretation of package settings " + packSettingsName, "Each subgroup must have an \"id\"");
    }
    else if (IDs.includes(currentsubgroup.id) === true)
    {
        bParsedSuccessfully = false;
        ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, " Duplicate subgroup IDs are not allowed.")
    }
    else
    {
        IDs.push(currentsubgroup.id);
    }

    // validate enabled (set to enabled if left undefined)
    if (currentsubgroup.enabled === undefined) { currentsubgroup.enabled = true; }

    // validate distributionEnabled (set to enabled if left undefined)
    if (currentsubgroup.distributionEnabled === undefined) { currentsubgroup.distributionEnabled = true; }

    // validate allowUnique (set to true if left undefined)
    if (currentsubgroup.allowUnique === undefined) { currentsubgroup.allowUnique = true; }

    // validate allowNonUnique (set to true if left undefined)
    if (currentsubgroup.allowNonUnique === undefined) { currentsubgroup.allowNonUnique = true; }

    // validate distribution weighting
    if (currentsubgroup.probabilityWeighting === undefined)
    {
        currentsubgroup.probabilityWeighting = 1;
    }
    else if ( isNaN(currentsubgroup.probabilityWeighting) === true)
    {
        bParsedSuccessfully = false;
        ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "probabilityWeighting must be a number")
    }

    // validate allowedRaces (set to [] if undefined)
    if (currentsubgroup.allowedRaces === undefined) { currentsubgroup.allowedRaces = []; }

    // validate dispaths (set to [] if undefined)
    if (currentsubgroup.disallowedRaces === undefined) { currentsubgroup.disallowedRaces = []; }

    // validate allowedAtributes (set to [] if undefined)
    if (currentsubgroup.allowedAttributes === undefined) { currentsubgroup.allowedAttributes = []; }
    // make sure they are pairs
    else if (currentsubgroup.allowedAttributes.length > 0)
    {
        for (let i = 0; i < currentsubgroup.allowedAttributes.length; i++)
        {
            if (currentsubgroup.allowedAttributes[i].length != 2)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "allowedAttributes must be an array of arrays of length 2, such as [\"VTCK\", \"MaleYoungEager\"]");
            }
        }
    }

    // validate disallowedAttributes (set to [] if undefined)
    if (currentsubgroup.disallowedAttributes === undefined) { currentsubgroup.disallowedAttributes = []; }
    // make sure they are pairs
    else if (currentsubgroup.disallowedAttributes.length > 0)
    {
        for (let i = 0; i < currentsubgroup.disallowedAttributes.length; i++)
        {
            if (currentsubgroup.disallowedAttributes[i].length != 2)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "disallowedAttributes must be an array of arrays of length 2, such as [\"VTCK\", \"MaleYoungEager\"]");
            }
        }
    }

    // validate forceIfAttributes
    if (currentsubgroup.forceIfAttributes === undefined)
    {
        currentsubgroup.forceIfAttributes = [];
    }
    else if (currentsubgroup.forceIfAttributes.length > 0)
    {
        for (let i = 0; i < currentsubgroup.forceIfAttributes.length; i++)
        {
            if (currentsubgroup.forceIfAttributes[i].length != 2)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "forceIfAttributes must be an array of arrays of length 2, such as [\"VTCK\", \"MaleYoungEager\"]");
            }
        }
    }

    // validate requiresubgroups (set to [] if undefined)
    if (currentsubgroup.requiredSubgroups === undefined) { currentsubgroup.requiredSubgroups = []; }
    else
    {
        for (let i = 0; i < currentsubgroup.requiredSubgroups.length; i++)
        {
            if (Aux.bSubgroupHasChildSubgroup(subgroupHierarchy, currentsubgroup.requiredSubgroups[i]) === false)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "Required Subgroup \"" + currentsubgroup.requiredSubgroups[i] + "\" does not exist within this config file");
            }
        }
    }

    // validate excludesubgroups (set to [] if undefined)
    if (currentsubgroup.excludedSubgroups === undefined) { currentsubgroup.excludedSubgroups = []; }
    else
    {
        for (let i = 0; i < currentsubgroup.excludedSubgroups.length; i++)
        {
            if (Aux.bSubgroupHasChildSubgroup(subgroupHierarchy, currentsubgroup.excludedSubgroups[i]) === false)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "Excluded Subgroup \"" + currentsubgroup.excludedSubgroups[i] + "\" does not exist within this config file");
            }
        }
    }

    // validate addKeywords (set to [] if undefined)
    if (currentsubgroup.addKeywords === undefined) { currentsubgroup.addKeywords = []; }
    Aux.copyArrayInto(currentsubgroup.addKeywords, userKeywords);

    // validate paths (set to [] if undefined)
    if (currentsubgroup.paths === undefined) { currentsubgroup.paths = []; }
    else if (currentsubgroup.paths.length > 0)
    {
        for (let i = 0; i < currentsubgroup.paths.length; i++)
        {
            if (currentsubgroup.paths[i].length !== 2)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "paths must be an array of arrays of length 2, such as [\"textures\\myAssetPatck\\actors\\character\\male\\malehands_1.dds\", \"malehands_1.dds\"]");
            }
            else if (currentsubgroup.paths[i][0].toLowerCase().indexOf("skyrim.esm\\") !== 0) // ignore paths prefixed with Skyrim.esm
            {
                fullPath = xelib.GetGlobal('DataPath') + currentsubgroup.paths[i][0];
                if (fh.jetpack.exists(fullPath) === false)
                {
                    pathWarnings.push("Warning in: " + packSettingsName, "File " + fullPath + " was not found.");
                }       
            }
        }
    }

    // validate BodyGen presets
    if (currentsubgroup.allowedBodyGenDescriptors === undefined) { currentsubgroup.allowedBodyGenDescriptors = []; }
    if (currentsubgroup.disallowedBodyGenDescriptors === undefined) { currentsubgroup.disallowedBodyGenDescriptors = []; }

    // validate subgroups (set to [] if undefined)
    if (currentsubgroup.subgroups === undefined) { currentsubgroup.subgroups = []; }

    // move on to next subgroup layer if necessary
    for (let i = 0; i < currentsubgroup.subgroups.length; i++)
    {
        bParsedSuccessfully = validatesubgroupSettings(currentsubgroup.subgroups[i], bParsedSuccessfully, packSettingsName, ErrorHandler, fh, pathWarnings, IDs, userKeywords, subgroupHierarchy);
    }
    return bParsedSuccessfully
}


function validateGroupDefinitionSettings(currentRestrictionGroupSettings, bDisplayAlerts, fileName, bParsedSuccessfully, ErrorHandler)
{
    let groupName = "";

    if (Array.isArray(currentRestrictionGroupSettings) === false)
    {
        ErrorHandler.logError("Interpretation of Race Group Definition settings (unnamed) in file " + fileName, "JSON files containing restriction groups must be arrays. Please see the GroupDefs.json file distributed with this patcher for an example");
        return  true;
    }

    if (currentRestrictionGroupSettings.length > 0)
    {
        for (let i = 0; i < currentRestrictionGroupSettings.length; i++) {
            if (currentRestrictionGroupSettings[i].name === undefined || currentRestrictionGroupSettings[i].name.length === 0) {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of Race Group Definition settings (unnamed) in file " + fileName, "The \"name\" field must be set so that this group has a name");
            } else {
                groupName = currentRestrictionGroupSettings[i].name;
            }

            if (currentRestrictionGroupSettings[i].entries === undefined)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of Race Group Definition settings (" + groupName + ") in file " + fileName, "The group must have an \"entrires\" field populated by an array of RNAM records");
            }
            else if (Array.isArray(currentRestrictionGroupSettings[i].entries) === false)
            {
                bParsedSuccessfully = false;
                ErrorHandler.logError("Interpretation of Race Group Definition settings (" + groupName + ") in file " + fileName, "The group must have an \"entrires\" field populated by an array of RNAM records");
            }
        }
    }

    return bParsedSuccessfully;
}

function updateTrimPaths(trimPathArray, newTrimPath)
{
    let bFound = false;
    for (let i = 0; i < trimPathArray.length; i++)
    {
        if (trimPathArray[i].extension === newTrimPath.extension)
        {
            bFound = true;
            trimPathArray[i].pathToTrim = newTrimPath.pathToTrim;
        }
    }
    if (bFound === false)
    {
        trimPathArray.push(newTrimPath);
    }
}

let verboseLogString = "";
let permutationBuildupLogString = "";