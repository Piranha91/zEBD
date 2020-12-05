let Aux = require('./Auxilliary.js');

module.exports = function(logDir, fh, modulePath)
    {
        let IO = {};
        let ErrorHandler = require ('./Errorhandler.js')(logDir, fh);

        IO.loadBodyGenConfig = function(loadPath)
        {
            let path_BodyGenConfig = loadPath + "\\NPC Configuration\\BodygenConfig.json";
            let cfg = {};

            try
            {
                cfg = fh.loadJsonFile(path_BodyGenConfig);
            } catch (e)
            {
            }

            if (cfg === undefined)
            {
                cfg = {};
            }

            if (cfg.racialSettingsFemale === undefined)
            {
                cfg.racialSettingsFemale = [];
            }

            if (cfg.racialSettingsMale === undefined)
            {
                cfg.racialSettingsMale = [];
            }

            if (cfg.templates === undefined)
            {
                cfg.templates = [];
            }

            // v1.8 update: assign blank weight range to templates from previous versions
            for (let i = 0; i < cfg.templates.length; i++)
            {
                if (cfg.templates[i].weightRange === undefined)
                {
                    cfg.templates[i].weightRange = ["", ""];
                }
            }

            if (cfg.templateGroups === undefined)
            {
                cfg.templateGroups = [];
            }

            if (cfg.templateDescriptors === undefined)
            {
                cfg.templateDescriptors = [];
            }

            return cfg;
        }

        IO.saveBodyGenConfig = function(bodyGenConfig, savePath)
        {
            let path = savePath + "\\NPC Configuration\\BodygenConfig.json";

            try
            {
                fh.saveJsonFile(path, bodyGenConfig);
                alert("Body Configuration Saved");
            }
            catch (e)
                    {
                    }
        }

        IO.loadSelectedBodyGenConfig = function(currentBodyGenConfig)
        {
            let path = fh.selectFile("BodyGen Configurations", "", [{ name: 'JSON files', extensions: ['json'] }]);
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

                            // new in v1.8: weight range
                            if (currentBodyGenConfig.templates[j].weightRange === undefined)
                            {
                                currentBodyGenConfig.templates[j].weightRange = ["", ""];
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

        IO.loadSelectedBodyGenTemplate = function (existingTemplates)
        {
            let path = fh.selectFile("BodyGen Templates", "", [{ name: 'INI files', extensions: ['ini'] }]);
            if (path === undefined)
            {
                return;
            }
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
                            existingTemplates.push(newTemplate);
                        }
                    }
                }
            } catch (e)
            {
            }
        }

        IO.loadSelectedBodyGenMorphs = function(forceNPClist, NPClist, templateList)
        {
            let path = fh.selectFile("BodyGen Morphs", "", [{ name: 'INI files', extensions: ['ini'] }]);
            if (path === undefined)
            {
                return;
            }
            let input;
            try
            {
                input = fh.loadTextFile(path);
            }
            catch (e)
            {
                return;
            }

            let split = input.split(/\r?\n/);
            let linesplit = [];
            let settingsplit = [];
            let rootPlugin;
            let formID = "";
            let morphNameConcat = "";
            let morphNames = [];
            let alertString = "";
            let showMainAlert = false;

            for (let i = 0; i < split.length; i++)
            {
                if (split[i].indexOf('#') === 0) { continue; }
                linesplit = split[i].split('|');
                if (linesplit.length !== 2)
                {
                    continue;
                }
                rootPlugin = linesplit[0].trim();
                settingsplit = linesplit[1].split('=');
                formID = settingsplit[0].trim();

                if (settingsplit.length === 1)
                {
                    alertString += "No morph was set in the ini file for NPC \"" + rootPlugin + "|" + formID + "\". Skipping this NPC.\n";
                }
                else if (settingsplit.length === 2)
                {
                    morphNameConcat = settingsplit[1].trim();
                    morphNames = morphNameConcat.split(',');
                    for (let j = 0; j < morphNames.length; j++)
                    {
                        morphNames[j] = morphNames[j].trim();
                    }
                }
                else
                {
                    continue;
                }

                // make sure morphs exist
                let bAllTemplatesExist = true;
                let bTemplateExists = false;
                for (let j = 0; j < morphNames.length; j++)
                {
                    for (let k = 0; k < templateList.length; k++)
                    {
                        if (templateList[k].name === morphNames[j])
                        {
                            bTemplateExists = true;
                            break;
                        }
                    }
                    if (bTemplateExists === false)
                    {
                        alertString += "The morph \"" + morphNames[j] + "\" assigned to NPC \"" + rootPlugin + "|" + formID + "\" does not exist in the Template List. Skipping.\n";
                        bAllTemplatesExist = false; 
                    }
                }
                if (bAllTemplatesExist === false)
                {
                    continue;
                }
                //
                
                // fix formID padding
                for (let j = formID.length; j < 6; j++)
                {
                    formID = "0" + formID;
                }

                // search for NPC in force list
                let bFoundInForceList = false;
                for (let j = 0; j < forceNPClist.length; j++)
                {
                    if (forceNPClist[j].formID.substring(2, 9) === formID && forceNPClist[j].rootPlugin === rootPlugin)
                    {
                        forceNPClist[j].forcedBodyGenMorphs = morphNames;
                        bFoundInForceList = true;
                        break;
                    }
                }
                
                // search for NPC in full NPC list if necessary
                let bFoundinNPCList = false;
                if (bFoundInForceList === false)
                {
                    for (let j = 0; j < NPClist.length; j++)
                    {
                        if (NPClist[j].formID.substring(2, 9) === formID && NPClist[j].rootPlugin === rootPlugin)
                        {
                            bFoundinNPCList = true;
                            Aux.addNPCtoForceList(NPClist[j], forceNPClist);
                            forceNPClist[forceNPClist.length - 1].forcedBodyGenMorphs = morphNames;
                            break;
                        }
                    }
                }

                //show final alert
                if (bFoundInForceList === false && bFoundinNPCList === false)
                {
                    alertString += "NPC \"" + rootPlugin + "|" + formID + "\" was not found. Skipping this NPC.\n";
                    showMainAlert = true;
                }
            }
            if (showMainAlert === true)
            {
                alertString = "Some NPCs were not found in the current NPC list. If these NPCs are not in the main Skyrim.esm plugin or one of the DLCs, please go to the Specific NPC Assignments or Block List tab, click \"Load NPCs from Mods\", and try again.\n\n" + alertString;
            }

            alertString = "Morph loading complete. Please check the assignments in the Specific NPC Assignments tab. CLICK \"Save Forced NPC List\" or these assignments will NOT be respected.\n\n" + alertString;

            alert(alertString);
        }

        IO.loadHeightPresets = function(loadPath)
        {
            let path_HeightPresets = loadPath + "\\zEBD assets\\Height Presets";
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
                        heightConfig = [];
                    }

            if (heightConfig === undefined)
            {
                heightConfig = [];
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
        
        IO.loadAssetPackSettings = function(loadPath, bDisplayAlerts, userKeywords, bThrowErrorIfFail, bValidateConfigs, bAbortIfPathWarnings)
        {
            let path_packSettingsDir = loadPath + "\\zEBD Assets\\Asset Pack Settings";
            let packSettingsArray = [];

            if (fh.jetpack.exists(path_packSettingsDir) !== "dir")
            {
                return packSettingsArray;
            }

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
                        bParsedSuccssfully = IO.validatePackSettings(currentPackSettings, bParsedSuccssfully, pathWarnings, userKeywords, []);

                        if (bAbortIfPathWarnings === true && pathWarnings.length > 0)
                        {
                            throw new Error("Assets expected by Settings file " + files[i] + " were not found. Please validate this config file from the settings menu. Patching aborted.");
                        }
                    }

                    if (bParsedSuccssfully === true)
                    {
                        currentPackSettings.sourcePath = path_packSettingsDir + "\\" + files[i];
                        packSettingsArray.push(currentPackSettings);

                        if (bDisplayAlerts === true && currentPackSettings.displayAlerts === true && currentPackSettings.userAlert.length > 0)
                        {
                            alert(currentPackSettings.userAlert);
                        }

                        if (currentPackSettings.probabilityWeighting === undefined)
                        {
                            currentPackSettings.probabilityWeighting = 1;
                        }
                        else if (currentPackSettings.probabilityWeighting < 0)
                        {
                            currentPackSettings.probabilityWeighting = 0; // to prevent infinite loops
                        }
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

        IO.appendAssetPackSettings = function (currentPackSettings)
        {
            let path = fh.selectFile("Config Files", "", [{ name: 'JSON files', extensions: ['json'] }]);
            if (path === undefined)
            {
                return;
            }

            let appendedPackSettings = fh.loadJsonFile(path);
            if (IO.validatePackSettings(appendedPackSettings, true, [], [], []) === false)
            {
                alert("The selected config file had an error and could not be appended.");
            }
            else
            {
                for (let i = 0; i < appendedPackSettings.subgroups.length; i++)
                {
                    this.mergeSubgroups(currentPackSettings.subgroups, appendedPackSettings.subgroups[i]);
                }
            }
        }

        IO.mergeSubgroups = function (currentSubgroupLayer, currentMergedSubgroup)
        {
            let matchedSubgroupIndex = -1;
            for (let i = 0; i < currentSubgroupLayer.length; i++)
            {
                if (currentSubgroupLayer[i].id === currentMergedSubgroup.id)
                {
                    matchedSubgroupIndex = i;
                    break;
                }
            }

            if (matchedSubgroupIndex === -1)
            {
                currentSubgroupLayer.push(currentMergedSubgroup);
            }
            else
            {
                for (let i = 0; i < currentMergedSubgroup.subgroups.length; i++)
                {
                    this.mergeSubgroups(currentSubgroupLayer[matchedSubgroupIndex].subgroups, currentMergedSubgroup.subgroups[i]);    
                }
            }
        }

        IO.loadDefaultRaceDict = function(modulePath) // this loads the default race dictionary. Only necessary for debugging purposes because it allows zEdit to skip Skyrim.esm to speed up patching time.
        {
            let path_RaceDict = modulePath + "\\zEBD Assets\\MiscConfig\\DefaultRaceDict.json";

            let defaultRaceDict = {};
            try
            {
                defaultRaceDict = fh.loadJsonFile(path_RaceDict);
            }
            catch
            {
                defaultRaceDict = {};
            }

            defaultRaceDict.allEDIDs = [];
            defaultRaceDict.allFormIDs = [];

            for (let [EDID, formID] of Object.entries(defaultRaceDict))
            {
                defaultRaceDict[formID] = EDID;

                defaultRaceDict.allEDIDs.push(EDID);
                defaultRaceDict.allFormIDs.push(formID);
            }

            return defaultRaceDict;
        }

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

        IO.generatePermutationLog = function (permutationHolders, logDir, permAssignmentTracker)
        {
            let writePath = logDir + "\\PermutationsGenerated.txt";
            let writeStrings = "";
            let writeString = "";
            let permIndex = 0;
            let pathArray = [];

            writeStrings += "Assignment Counts: \n"
            for (let [assetPack, count] of Object.entries(permAssignmentTracker))
            {
                writeStrings += assetPack + ": assigned to " + count + " NPCs\n"; 
            }
            writeStrings += "\n";

            for (let i = 0; i < permutationHolders.length; i++)
            {
                permIndex++;
                writeString = permIndex + ": " + permutationHolders[i].nameString + " (gender: " + permutationHolders[i].gender + ") from: " + permutationHolders[i].sourceAssetPack;
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

                if (permutationHolders[i].weightRange != undefined && permutationHolders[i].weightRange.length > 0)
                {
                    writeString = "\tWeight Range: ";
                    if (Aux.isValidNumber(permutationHolders[i].weightRange[0]) === false)
                    {
                        writeString += "_"
                    }
                    else
                    {
                        writeString += permutationHolders[i].weightRange[0].toString();
                    }

                    writeString += " - ";

                    if (Aux.isValidNumber(permutationHolders[i].weightRange[1]) === false)
                    {
                        writeString += "_"
                    }
                    else
                    {
                        writeString += permutationHolders[i].weightRange[1].toString();
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

                    pathArray = [];
                    for (let j = 0; j < permutationHolders[i].paths.length; j++)
                    {
                        if (pathArray.includes(permutationHolders[i].paths[j][0]) === false)
                        {
                            pathArray.push(permutationHolders[i].paths[j][0]);
                        }
                    }

                    for (let j = 0; j < pathArray.length; j++)
                    {
                        writeString += "\t\t" + pathArray[j] + "\n";

                    }
                    writeStrings += writeString;
                }

                if (permutationHolders[i].writtenRecords != undefined && permutationHolders[i].writtenRecords.length > 0)
                {
                    writeStrings += "\tGenerated Records: \n";
                    for (let j = 0; j < permutationHolders[i].writtenRecords.length; j++)
                    {
                        writeStrings += "\t\t" + permutationHolders[i].writtenRecords[j] + "\n";
                    }

                    
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

        IO.validatePackSettings = function(currentPackSettings, bParsedSuccessfully, pathWarnings, userKeywords, otherAlerts)
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
            if (currentPackSettings.userAlert === undefined)
            {
                currentPackSettings.userAlert = "";
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
                    if (currentPackSettings.subgroups[i].enabled === false)
                    {
                        otherAlerts.push("Warning: top-level subgroup " + currentPackSettings.subgroups[i].id + " (" + currentPackSettings.subgroups[i].name +") in " + currentPackSettings.groupName + " is disabled. Disabling a top-level subgroup causes the entire config file to be disabled. Make sure you actually meant to do this.\n");
                    }
                }
            }

            return bParsedSuccessfully;
        };

        IO.loadRecordTemplates = function(modulePath, groupDefs, logMessage)
        {
            let path_RecordTemplates = modulePath + "\\zEBD Assets\\RecordTemplates";
            let recordTemplateArray = [];
            let fs = require('fs');
            let files = fs.readdirSync(path_RecordTemplates);
            let bParsedSuccessfully = true;
            let currentRecordTemplateObj = {};
            let generatedIDs = {};
            let allLoaded = true;

            for (let i = 0; i < files.length; i++)
            {
                if (files[i].split('.').pop().toLowerCase() === "json")
                {
                    try
                    {
                        currentRecordTemplateObj = fh.loadJsonFile(path_RecordTemplates + "\\" + files[i]);
                    } catch (e)
                    {
                        bParsedSuccessfully = false;
                        ErrorHandler.logError("Record Template loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.")
                        logMessage("Record Template loading", "File " + files[i] + " could not be parsed. Check your JSON formatting.");
                        allLoaded = false;
                        continue;
                    }

                    bParsedSuccessfully = validateRecordTemplates(currentRecordTemplateObj.records, generatedIDs, logMessage);
                    // CALL A PARSING FUNCTION LATER WHEN I HAVE A BETTER SENSE OF WHICH EXCEPTIONS MUST BE HANDLED

                    if (bParsedSuccessfully === true)
                    {
                        for (let j = 0; j < currentRecordTemplateObj.records.length; j++)
                        {
                            if (Array.isArray(currentRecordTemplateObj.records[j].zEBDsupportedRaces) === true)
                            {
                                currentRecordTemplateObj.records[j].zEBDsupportedRaces = Aux.replaceGroupDefWithIndividuals(currentRecordTemplateObj.records[j].zEBDsupportedRaces, groupDefs);
                            }
                            else
                            {
                                currentRecordTemplateObj.records[j].zEBDsupportedRaces = Aux.replaceGroupDefWithIndividuals([currentRecordTemplateObj.records[j].zEBDsupportedRaces], groupDefs);
                            }

                            Aux.getArrayUniques(currentRecordTemplateObj.records[j].zEBDsupportedRaces);
                            recordTemplateArray.push(currentRecordTemplateObj.records[j]);
                        }
                    }
                    else
                    {
                        allLoaded = false;
                    }
                }
            }

            if (allLoaded === false)
            {
                ErrorHandler.alertError("An error occured during Record Template Loading loading.");
                throw new Error("Please fix the Record Template errors shown in the patcher log and try again.");
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

        IO.loadConsistency = function(loadPath, bEnableConsistency)
        {
            let path = loadPath + "\\NPC Configuration\\Consistency.json";
            let consistency;

            if (bEnableConsistency === true)
            {
                consistency = fh.loadJsonFile(path);
            }

            if (consistency === undefined) // consistency file deleted or not yet generated
            {
                consistency = [];
            }
            else // update consistency format for versions < 1.9
            {
                for (let i = 0; i < consistency.length; i++)
                {
                    if (consistency[i].formIDSignature.length === 6)
                    {
                        consistency[i].formIDSignature = "xx" + consistency[i].formIDSignature;
                    }
                }
            }

            return consistency;
        };

        IO.saveConsistency = function (savePath, NPCAssignments)
        {
            let path = savePath + "\\NPC Configuration\\Consistency.json";

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

        IO.deleteConsistency = function(prePath, mode)
        {
            let consistencyPath = prePath + "\\NPC Configuration\\Consistency.json";
            let dateString = Aux.generateDateString();
            let moveTo = consistencyPath.split('.').slice(0, -1).join('.') + "_" + dateString + ".json.bak"; // backup path is previous path without file extension + datestring + .json.bak

            let consistency = fh.loadJsonFile(consistencyPath);
            if (consistency === undefined)
            {
                return;
            }

            if (mode === "all")
            {
                fh.jetpack.move(consistencyPath, moveTo);
            }
            else
            {
                fh.jetpack.copy(consistencyPath, moveTo);
                for (let i = 0; i < consistency.length; i++)
                {
                    switch(mode)
                    {
                        case "assets":
                            if (consistency[i].assignedAssetPack !== undefined)
                            {
                                delete consistency[i].assignedAssetPack;
                            }
                            if (consistency[i].assignedPermutation !== undefined)
                            {
                                delete consistency[i].assignedPermutation;
                            }
                            break;
                        case "height":
                            if (consistency[i].height !== undefined)
                            {
                                delete consistency[i].height;
                            }
                            break;
                        case "bodygen":
                            if (consistency[i].assignedMorphs !== undefined)
                            {
                                delete consistency[i].assignedMorphs;
                            }
                            if (consistency[i].assignedGroups !== undefined)
                            {
                                delete consistency[i].assignedGroups;
                            }
                            break;
                    }
                }

                this.saveConsistency(prePath, consistency);
            }     
        };

        IO.loadBlockList = function(loadPath)
        {
            let path = loadPath + "\\NPC Configuration\\BlockList.json";
            let blockList = fh.loadJsonFile(path);
            let bUpgradeAlert = false;


            if (blockList === undefined)
            {
                blockList = {};
            }

            if (blockList.blockedNPCs === undefined)
            {
                blockList.blockedNPCs = [];
            }
            if (blockList.blockedPlugins === undefined)
            {
                blockList.blockedPlugins = [];
            }

            for (let i = 0; i < blockList.blockedNPCs.length; i++)
            {
                if (blockList.blockedNPCs[i].bBlockAssets === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedNPCs[i].bBlockAssets = true;
                }

                if (blockList.blockedNPCs[i].bBlockHeight === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedNPCs[i].bBlockHeight = true;
                }

                if (blockList.blockedNPCs[i].bBlockBodyGen === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedNPCs[i].bBlockBodyGen = true;
                }
            }

            for (let i = 0; i < blockList.blockedPlugins.length; i++)
            {
                if (Aux.isObject(blockList.blockedPlugins[i]) === false)
                {
                    let tempPlugin = {};
                    tempPlugin.name = blockList.blockedPlugins[i];
                    blockList.blockedPlugins[i] = tempPlugin;
                    bUpgradeAlert = true;
                }

                if (blockList.blockedPlugins[i].bBlockAssets === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedPlugins[i].bBlockAssets = true;
                }

                if (blockList.blockedPlugins[i].bBlockHeight === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedPlugins[i].bBlockHeight = true;
                }

                if (blockList.blockedPlugins[i].bBlockBodyGen === undefined)
                {
                    bUpgradeAlert = true;
                    blockList.blockedPlugins[i].bBlockBodyGen = true;
                }
            }

            if (bUpgradeAlert === true)
            {
                alert("Your block list has been upgraded to the version 1.5 standard. Please review it and adjust as necessary.")
            }

            return blockList;
        };

        IO.loadForceList = function(loadPath)
        {
            let path = loadPath + "\\NPC Configuration\\ForceNPCList.json";
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

        IO.saveForceList = function(savePath, forceList)
        {
            let path = savePath + "\\NPC Configuration\\ForceNPCList.json";
            try
            {
                fh.saveJsonFile(path, forceList);
                alert("Force List Saved");
            }
            catch (e)
            {

            }
        }

        IO.saveBlockList = function(savePath, blockList)
        {
            let path = savePath + "\\NPC Configuration\\BlockList.json";
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

            if (exclusions === undefined)
            {
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
                alert("Exclusion List could not be saved. Please check that the file is not in use.");
            }
        }

        IO.loadLinkGroups = function(modulePath)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\linkGroups.json";

            let linkGroups;

            try 
            {
                linkGroups = fh.loadJsonFile(path);
            }
            catch{
                linkGroups = [];
            }

            if (linkGroups === undefined)
            {
                linkGroups = [];
            }

            return linkGroups;
        }

        IO.saveLinkGroups = function(modulePath, exclusions)
        {
            let path = modulePath + "\\zEBD Assets\\MiscConfig\\linkGroups.json";

            try 
            {
                fh.saveJsonFile(path, exclusions);
                alert("Link Groups Saved");
            }
            catch (e)
            {
                alert("Link Groups could not be saved. Please check that the file is not in use.");
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
            let inFileString = "";
            let inFileLines = [];
            let writeString = "";
            let check1 = false;
            let check2 = false;
            let check3 = false;
            let check4 = false;
            let alertString = "";

            let pathlist = ["SKSE\\plugins\\skee64.ini", "SKSE\\plugins\\skeevr.ini"]
            let path;

            for (let i = 0; i < pathlist.length; i++)
            {
                path = gameDataPath + pathlist[i];
                if (fh.jetpack.exists(path) === "file")
                {
                    break;
                }
                path = "";
            }

            if (path !== "")
            {
                inFileString = fh.loadTextFile(path);
                inFileLines = inFileString.split(/\r?\n/);

                for (let i = 0; i < inFileLines.length; i++)
                {
                    if (inFileLines[i].trim().indexOf("iScaleMode") === 0)
                    {
                        //inFileLines[i] = "iScaleMode=2";
                        check1 = true;
                        //alertString += "Set iScaleMode=2 \n";
                        alertString += "Note to users: Originally this button set iScaleMode=2, as perscribed by MCSmarties for his Diverse Races BodyGen morphs. However, it seems that RaceMenu has a bug that causes weapons to become extra large with this setting, so iScaleMode is untouched for the time being. Therefore, some morphs may not appear as expected. If Racemenu updates to fix the issue or you prefer dealing with the oversized weapons bug, you may manually set iScaleMode=2 in the skee(64/vr).ini \n";
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
                alert("Could not find an ini file at Data\\SKSE\\plugins\\. \nMake sure that RaceMenu is installed.");
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
    else if (Aux.isValidNumber(currentsubgroup.probabilityWeighting) === false)
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

    // validate weight range
    if (currentsubgroup.weightRange === undefined)
    {
        currentsubgroup.weightRange = ["",""];
    }
    else if (currentsubgroup.weightRange.length != 2)
    {
        bParsedSuccessfully = false;
        ErrorHandler.logError("Interpretation of package settings " + packSettingsName + " at ID " + currentsubgroup.id, "Weight Range must be an array of arrays of length 2, such as [\"0\", \"50\"]");
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
    userKeywords.push(...currentsubgroup.addKeywords);

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

function validateRecordTemplates(recordTemplates, generatedIDs, logMessage)
{
    let IDsFromCurrent = [];
    let bMatched = false;
    let bValid = true;

    for (let i = 0; i < recordTemplates.length; i++)
    {
        if (generatedIDs[recordTemplates[i].zEBDUniqueID] === undefined)
        {
            generatedIDs[recordTemplates[i].zEBDUniqueID] = [];
        }
        
        IDsFromCurrent = [];
        Aux.getAllValuesInObject(recordTemplates[i], IDsFromCurrent, "zEBDUniqueID");

        for (let j = 0; j < IDsFromCurrent.length; j++)
        {
            if (generatedIDs[recordTemplates[i].zEBDUniqueID].includes(IDsFromCurrent[j]) === false) // check for duplicate UniqueIDs within the current RecordTemplate
            {
                for (let [otherRecordTemplateID, containedIDs] of Object.entries(generatedIDs))
                {
                    if (containedIDs.includes(IDsFromCurrent[j]))
                    {
                        logMessage("Found zEBDUniqueID \"" + IDsFromCurrent[j] + "\" within both \"" + otherRecordTemplateID + "\" and \"" + recordTemplates[i].zEBDUniqueID + "\". Duplicate IDs are not allowed.");
                        bMatched = true;
                        bValid = false;
                    }
                }
                if (bMatched === false)
                {
                    generatedIDs[recordTemplates[i].zEBDUniqueID].push(IDsFromCurrent[j]);
                }
            }
            else
            {
                logMessage("Found duplicate zEBDUniqueID \"" + IDsFromCurrent[j] + "\" within top-level record template \"" + recordTemplates[i].zEBDUniqueID + "\". Duplicate IDs are not allowed.");
                bValid = false;
            }
        }
    }

    return bValid;
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

function collectZEBDLinkToRecords(obj, storedRecords, categorizedTemplateList)
{
    for (let [attribute, value] of Object.entries(obj))
    {
        if (attribute === "$zEBDLinkTo")
        {
            storedRecords.unshift(categorizedTemplateList[value.zEBDUniqueID][value.sourceAssetPack][value.index]);
        }
        else if (Array.isArray(value))
        {
            for (let i = 0; i < value.length; i++)
            {
                if (Aux.isObject(value[i]))
                {
                    collectZEBDLinkToRecords(value[i], storedRecords, categorizedTemplateList);
                }
            }
        }
        else if (Aux.isObject(value))
        {
            collectZEBDLinkToRecords(value, storedRecords, categorizedTemplateList);
        }
    }
}