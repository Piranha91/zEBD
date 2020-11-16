debugger;
let logDir = modulePath + "\\Logs";
let IO = require(modulePath + '\\lib\\IO.js')(logDir, fh, modulePath);
let Aux = require(modulePath + '\\lib\\Auxilliary');
let PG = require(modulePath + '\\lib\\PermutationGenerator.js')();
let RG = require(modulePath + '\\lib\\RecordGenerator.js')(logDir, fh);
let deserializer = require(modulePath + "\\lib\\ObjectToRecord.js")(logDir, fh, xelib);
let PO = require(modulePath + '\\lib\\PatcherOps.js')(logDir, fh, xelib);
let BGI = require(modulePath + '\\lib\\BodyGenIntegration.js')();

ngapp.run(function(patcherService) {
	patcherService.registerPatcher({
		info: info,
		gameModes: [xelib.gmSSE, xelib.gmTES5],
		settings:
			{
				label: 'zEBD NPC Customizer',
				templateUrl: `${moduleUrl}/partials/settings.html`,
				controller: function ($scope)
				{
					let patcherSettings = $scope.settings.zEBD;  //$scope.anything becomes available as "anything" in the html file
					switch(patcherSettings.bLoadFromData)
					{
						case false:
							patcherSettings.loadPath = modulePath;
							break;
						case true:
							patcherSettings.loadPath = xelib.GetGlobal('DataPath') + "zEBD";
							break;
					}

					$scope.assetPackSettings = IO.loadAssetPackSettings(patcherSettings.loadPath, patcherSettings.displayAssetPackAlerts, [], false, true, false);
					$scope.raceGroupDefinitions = IO.loadRestrictionGroupDefs(modulePath, patcherSettings.displayAssetPackAlerts);
					$scope.heightPresets = IO.loadHeightPresets(modulePath);
					$scope.heightConfiguration = IO.loadHeightConfiguration(patcherSettings.loadPath);
					$scope.bodyGenConfig = IO.loadBodyGenConfig(patcherSettings.loadPath);
					$scope.trimPaths = IO.loadTrimPaths(modulePath);
					$scope.LinkedNPCNameExclusions = IO.loadLinkedNPCNameExclusions(modulePath);
					$scope.linkGroups = IO.loadLinkGroups(modulePath);
					
					$scope.BodyGenItemDisplay = updateBodyGenItemDisplay($scope.bodyGenConfig);
					$scope.allAssetPacks = generateAvailableAssetPacks($scope.assetPackSettings);
					$scope.availableAssetPacks = [];
					$scope.availableAssetPackNames = [];
					$scope.availableSubgroups = [];
					
					$scope.consistencyRecords = IO.loadConsistency(patcherSettings.loadPath, true);

					$scope.forcedNPCAssignments = IO.loadForceList(patcherSettings.loadPath);
					$scope.blockList = IO.loadBlockList(patcherSettings.loadPath);

					if (patcherSettings.bVerboseMode === true)
					{
						IO.logVerbose("", true);
					};

					$scope.GUIobjects = {};
					$scope.genderOptions = ["male", "female"];
					$scope.heightDistOptions = ["uniform", "bell curve"];
					$scope.heightGlobals = { distModeGlobal: 'uniform', heightRangeGlobal: "0.020000", currentHeightPreset: undefined };
					$scope.bodyGenBool = ["AND", "OR"];
					$scope.availableNPCs = fh.loadJsonFile(modulePath + "\\zEBD assets\\Base NPC List\\NPClist.json");
					$scope.displayedNPCs = $scope.availableNPCs;
					$scope.loadedPlugins = xelib.GetLoadedFileNames(true);
					$scope.displayedPlugins = $scope.loadedPlugins;
					$scope.currentNPC = {};
					$scope.currentPlugin = "";
					$scope.currentLinkGroup = getBlankLinkGroup();
					$scope.availableRaces = patcherSettings.patchableRaces.slice(); // shallow copy intentional
					$scope.displayRGmembers = initializeRGmembers($scope.raceGroupDefinitions);
					$scope.racesAndGroups = updateAvailableRacesAndGroups($scope.availableRaces, $scope.raceGroupDefinitions);

					$scope.currentSettingsDisplay = "main";

					$scope.categorizedMorphs = BGI.categorizeMorphs($scope.bodyGenConfig, $scope.raceGroupDefinitions);

					// patchable races
					$scope.removePatchableRace = function(index)
					{
						patcherSettings.patchableRaces.splice(index, 1);
					};

					$scope.addPatchableRace = function()
					{
						patcherSettings.patchableRaces.push("");
					};

					$scope.getAvailableRaces = function()
					{
						let raceArray = xelib.GetRecords(0, "RACE", false);
						let EDID = "";
						for (let i = 0; i < raceArray.length; i++)
						{
							EDID = xelib.EditorID(raceArray[i]);
							if ($scope.availableRaces.includes(EDID) === false && xelib.HasKeyword(raceArray[i], "ActorTypeNPC") === true)
							{
								$scope.availableRaces.push(EDID);
							}
						}
					};

					$scope.updateAvailableRacesAndGroups = function()
					{
						$scope.racesAndGroups = updateAvailableRacesAndGroups($scope.availableRaces, $scope.raceGroupDefinitions);
					}
					//

					// group definitions
					$scope.addRaceToGroup = function(index)
					{
						$scope.raceGroupDefinitions[index].entries.push("");
					};

					$scope.addNewGroupDef = function()
					{
						let obj = {};
						obj.name = "";
						obj.entries = [];
						$scope.raceGroupDefinitions.push(obj);
					};
					$scope.removeGroupDef = function(index)
					{
						$scope.raceGroupDefinitions.splice(index, 1);
						$scope.racesAndGroups = updateAvailableRacesAndGroups($scope.availableRaces, $scope.raceGroupDefinitions);
					};

					$scope.removeRacefromGroupDef = function(groupDef, index)
					{
						groupDef.entries.splice(index, 1);
					};

					$scope.saveGroupDefs = function()
					{
						IO.saveRestrictionGroupDefs($scope.raceGroupDefinitions);
					};
					
					//

					// misc settings
					$scope.removeAlias = function(index)
					{
						patcherSettings.raceAliases.splice(index, 1);
					}
					$scope.addAlias = function()
					{
						let obj = {};
						obj.race = "";
						obj.aliasRace = "";
						obj.bMale = false;
						obj.bFemale = false;
						obj.bApplyToAssets = false;
						obj.bApplyToHeight = false;
						obj.bApplyToBodyGen = false;
						patcherSettings.raceAliases.push(obj);
					}
					$scope.removeTrimPath = function(index)
					{
						$scope.trimPaths.splice(index, 1);
					}
					$scope.addTrimPath = function()
					{
						let obj = {};
						obj.extension = "file extension";
						obj.pathToTrim = "path to trim";
						$scope.trimPaths.push(obj);
					}
					$scope.saveTrimPaths = function()
					{
						IO.saveTrimPaths(modulePath, $scope.trimPaths);
					}
					$scope.addLinkedNPCExclusion = function()
					{
						$scope.LinkedNPCNameExclusions.push("");
					}
					$scope.removeLinkedNPCExclusion = function(index)
					{
						$scope.LinkedNPCNameExclusions.splice(index, 1);
					}
					$scope.saveNPCLinkageExclusions = function()
					{
						IO.saveNPCLinkageExclusions(modulePath, $scope.LinkedNPCNameExclusions);
					}
					//

					// force list
					$scope.saveForceList = function()
					{
						IO.saveForceList(patcherSettings.loadPath, $scope.forcedNPCAssignments);
					};

					$scope.loadNPCs = function()
					{
						let excluded = [
							"Skyrim.esm",
							"Update.esm",
							"Dawnguard.esm",
							"HearthFires.esm",
							"Dragonborn.esm"
						];

						for (let LO = 0; LO < $scope.loadedPlugins.length; LO++)
						{	
							if (excluded.includes($scope.loadedPlugins[LO]))
							{
								continue;
							}
							let pluginHandle = xelib.FileByName($scope.loadedPlugins[LO]);
							let NPClist = xelib.GetRecords(pluginHandle, "NPC_", false);
							let NPC = {};
							for (let i = 0; i < NPClist.length; i++)
							{
								if (patcherSettings.patchableRaces.includes(xelib.GetRefEditorID(NPClist[i], 'RNAM')))
								{
									NPC = PO.getNPCinfo(NPClist[i], [], xelib); // don't send consistency to avoid slowing down the loader. Consistency index is obtained individually per-NPC in the consistency-modifying $scope functions.
									NPC.displayString = NPC.name + " | " + NPC.EDID + " | " + NPC.formID + " | " + NPC.race + " | " + NPC.rootPlugin;
									$scope.availableNPCs.push(NPC);
								}
							}
						}

						$scope.displayedNPCs = $scope.availableNPCs;
					};

					$scope.addNPCtoForceList = function(currentNPC)
					{
						Aux.addNPCtoForceList(currentNPC, $scope.forcedNPCAssignments);
					};

					$scope.removeNPCfromForceList = function(formID, rootPlugin)
					{
						for (let i = 0; i < $scope.forcedNPCAssignments.length; i++)
						{
							if ($scope.forcedNPCAssignments[i].formID === formID && $scope.forcedNPCAssignments[i].rootPlugin === rootPlugin)
							{
								$scope.forcedNPCAssignments.splice(i, 1);
							}
						}
					};

					$scope.clearForcedAssetPack = function(currentForcedNPC)
					{
						currentForcedNPC.forcedAssetPack = "";
						currentForcedNPC.forcedSubgroups = [];
					}

					$scope.removeNPCinfoFromConsistency = function(currentNPC, mode)
					{
						if ($scope.consistencyRecords === undefined || $scope.consistencyRecords === null || $scope.consistencyRecords.length === 0)
						{
							alert("No consistency file found.");
							return;
						}

						currentNPC.consistencyIndex = findNPCAssignmentIndex($scope.consistencyRecords, currentNPC);

						if (currentNPC.consistencyIndex > -1)
						{
							switch(mode)
							{
								case "assets":
									if ($scope.consistencyRecords[currentNPC.consistencyIndex].assignedAssetPack !== undefined)
									{
										delete $scope.consistencyRecords[currentNPC.consistencyIndex].assignedAssetPack;
									}
									if ($scope.consistencyRecords[currentNPC.consistencyIndex].assignedPermutation !== undefined)
									{
										delete $scope.consistencyRecords[currentNPC.consistencyIndex].assignedPermutation;
									}
									break;
								case "height":
									if ($scope.consistencyRecords[currentNPC.consistencyIndex].height !== undefined)
									{
										delete $scope.consistencyRecords[currentNPC.consistencyIndex].height;
									}
									break;
								case "bodygen":
									if ($scope.consistencyRecords[currentNPC.consistencyIndex].assignedMorphs !== undefined)
									{
										delete $scope.consistencyRecords[currentNPC.consistencyIndex].assignedMorphs;
									}
									if ($scope.consistencyRecords[currentNPC.consistencyIndex].assignedGroups !== undefined)
									{
										delete $scope.consistencyRecords[currentNPC.consistencyIndex].assignedGroups;
									}
									break;
							}

							IO.saveConsistency(patcherSettings.loadPath, $scope.consistencyRecords);
							alert("Consistency updated.")
						}
						else
						{
							alert("NPC not found in consistency records.")
						}
					}

					$scope.choosePacksForNPC = function(currentNPC)
					{
						if (currentNPC === null)
						{
							return [];
						}

						switch(currentNPC.gender)
						{
							case "male":
								$scope.availableAssetPacks = $scope.allAssetPacks.male;
								$scope.availableAssetPackNames = $scope.allAssetPacks.malenames;
								break;
							case "female":
								$scope.availableAssetPacks = $scope.allAssetPacks.female;
								$scope.availableAssetPackNames = $scope.allAssetPacks.femalenames;
								break;
						}
					};

					$scope.chooseSubgroupsForPack = function(currentAssetPackName, currentForcedSubgroups)
					{
						for (let i = 0; i < $scope.availableAssetPacks.length; i++)
						{
							if ($scope.availableAssetPacks[i].name === currentAssetPackName)
							{
								$scope.availableSubgroups = $scope.availableAssetPacks[i].subgroups.slice(); // shallow copy intentional

								for (let j = 0; j < $scope.availableSubgroups.length; j++) // replace subgroups that are already in currentForcedSubgroups so that they appear in the dropdown menu
								{
									for (let k = 0; k < currentForcedSubgroups.length; k++)
									{
										if ($scope.availableSubgroups[j].id === currentForcedSubgroups[k].id && $scope.availableSubgroups[j].description === currentForcedSubgroups[k].description && $scope.availableSubgroups[j].topLevelSubgroup === currentForcedSubgroups[k].topLevelSubgroup)
										{
											$scope.availableSubgroups[j] = currentForcedSubgroups[k];
										}
									}
								}

								break;
							}
						}
					};

					$scope.AddForcedSubgroup = function(forcedNPC)
					{
						forcedNPC.forcedSubgroups.push("");
					};

					$scope.removeForcedSubgroup = function(forcedNPC, index)
					{
						forcedNPC.forcedSubgroups.splice(index, 1);
					};
					
					$scope.chooseBodyGenForCurrentNPC = function(forcedNPC)
					{
						if (forcedNPC === null)
						{
							return [];
						}

						let rgMorphs = $scope.categorizedMorphs[forcedNPC.gender][forcedNPC.race]

						$scope.availableBodyGenMorphs = [];
						for (let group in rgMorphs)
						{
							for (let i = 0; i < rgMorphs[group].length; i++)
							{
								$scope.availableBodyGenMorphs.push(rgMorphs[group][i].name);
							}
						}

						Aux.getArrayUniques($scope.availableBodyGenMorphs);
					}

					$scope.AddForcedMorph = function(forcedNPC)
					{
						forcedNPC.forcedBodyGenMorphs.push("");
					};

					$scope.removeForcedMorph = function(forcedNPC, index)
					{
						forcedNPC.forcedBodyGenMorphs.splice(index, 1);
					};

					// FUNCTIONS FOR CONFIG FILES
					$scope.addSubgroupTop = function (index)
					{
						$scope.assetPackSettings[index].subgroups.push({
							id: 'defaultId',
							enabled: true,
							distributionEnabled: true,
							allowedRaces: [],
							disallowedRaces: [],
							allowedAttributes: [],
							disallowedAttributes: [],
							forceIfAttributes: [],
							allowUnique: true,
							allowNonUnique: true,
							name: 'Default Name',
							requiredSubgroups: [],
							excludedSubgroups: [],
							addKeywords: [],
							probabilityWeighting: 1,
							paths: [],
							subgroups: []
						});
					};

					$scope.saveAssetPackSetting = function (packSetting)
					{
						let pathWarnings = [];
						let otherAlerts = [];
						let bParsedSuccessfully = IO.validatePackSettings(packSetting, true, pathWarnings, [], otherAlerts);
						IO.warnUserAboutPaths(pathWarnings);

						if (bParsedSuccessfully === true)
						{
							IO.saveAssetPackSettings(packSetting, patcherSettings.loadPath);
						}
						else
						{
							alert("There is a problem with your current settings. Please see Logs\\zEBDerrors.txt\nYour settings were not saved.")
						}

						if (otherAlerts.join() !== "")
						{
							alert(otherAlerts);
						}
					};

					$scope.validateAssetPackSettings = function()
					{
						let pathWarnings = [];
						let otherAlerts = [];
						let bParsedSuccessfully = true;
						for (let i = 0; i < $scope.assetPackSettings.length; i++)
						{
							if (IO.validatePackSettings($scope.assetPackSettings[i], true, pathWarnings, [], otherAlerts) === false)
							{
								alert("There is a problem with settings file " + $scope.assetPackSettings[i].groupName + ". Please see Logs\\zEBDerrors.txt");
								bParsedSuccessfully = false;
							}
						}
						IO.warnUserAboutPaths(pathWarnings);

						if (otherAlerts.length > 0)
						{
							alert(otherAlerts);
						}

						if (bParsedSuccessfully === true && pathWarnings.length === 0 && otherAlerts.length === 0)
						{
							alert("No problems found.")
						}
					};

					$scope.newAssetPackSettings = function ()
					{
						let newSettings = {};
						newSettings.groupName = "DEFAULT";
						newSettings.gender = "female";
						newSettings.displayAlerts = true;
						newSettings.userAlert = "";
						newSettings.subgroups = [];
						$scope.assetPackSettings.push(newSettings);
					};

					$scope.appendAssetPack = function(index)
					{
						IO.appendAssetPackSettings($scope.assetPackSettings[index]);
					}

					$scope.clearConsistency = function(mode)
					{
						let confirmation;
						switch(mode)
						{
							case "assets":
								confirmation = confirm("Are you sure you want to delete your asset assignment consistency? Your current consistency settings will be backed up.");
								break;
							case "height":
								confirmation = confirm("Are you sure you want to delete your height assignment consistency? Your current consistency settings will be backed up.");
								break;	
							case "bodygen":
								confirmation = confirm("Are you sure you want to delete your BodyGen assignment consistency? Your current consistency settings will be backed up.");
								break;
							case "all":
								confirmation = confirm("Are you sure you want to delete your consistency file? Your current consistency settings will be backed up.");
								break;
						}
						if (confirmation === true)
						{
							IO.deleteConsistency(patcherSettings.loadPath, mode);
						}
					};

					$scope.deleteSavedPermutations = function()
					{
						IO.deleteSavedPermutationsRecords(patcherSettings.loadPath);
					}

					// FUNCTIONS FOR HEIGHT CONFIGURATION
					$scope.saveHeightConfig = function()
					{
						IO.saveHeightConfiguration(patcherSettings.loadPath, $scope.heightConfiguration);
					};

					$scope.applyHeightPreset = function(overridePresets)
					{
						let presets;  

						if (overridePresets !== undefined)
						{
							presets = overridePresets;
						}
						else
						{
							presets = $scope.heightGlobals.currentHeightPreset.presets;
						}

						if (!presets) return;
						for (let i = 0; i < presets.length; i++)
						{
							let preset = presets[i];
							for (let j = 0; j < $scope.heightConfiguration.length; j++)
							{
								let heightConfig = $scope.heightConfiguration[j];
								if (preset.EDID === heightConfig.EDID)
								{
									heightConfig.heightMale = preset["Male Height"];
									heightConfig.heightFemale = preset["Female Height"];
									break;
								}
							}
						}
					};
					
					$scope.removeHeightConfig = function(index)
					{
						$scope.heightConfiguration.splice(index, 1);
					};

					$scope.addHeightConfig = function()
					{
						let newPreset = {};
						newPreset.EDID = "Editor ID";
						newPreset.heightMale = "1.000000";
						newPreset.heightFemale = "1.000000";
						newPreset.heightMaleRange = "0.020000";
						newPreset.heightFemaleRange = "0.020000";
						newPreset.distMode = "uniform";
						$scope.heightConfiguration.push(newPreset);
					};

					$scope.applyHeightsFromPlugins = function()
					{
						let allRaces = xelib.GetRecords(0, "RACE", false);
						let newPreset = [];
						for (let i = 0; i < allRaces.length; i++)
						{
							let newRace = {};
							newRace.EDID = xelib.EditorID(allRaces[i]);						
							newRace["Male Height"] = xelib.GetValue(allRaces[i], "DATA\\Male Height");
							newRace["Female Height"]= xelib.GetValue(allRaces[i], "DATA\\Female Height");
							newPreset.push(newRace);
						}
						this.applyHeightPreset(newPreset, $scope.heightConfiguration);
					};

					$scope.applyGlobalHeightRange = function()
					{
						for (let i = 0; i < $scope.heightConfiguration.length; i++)
						{
							$scope.heightConfiguration[i].heightMaleRange = $scope.heightGlobals.heightRangeGlobal;
							$scope.heightConfiguration[i].heightFemaleRange = $scope.heightGlobals.heightRangeGlobal;
						}
					};

					$scope.applyGlobalDistMode = function()
					{
						for (let i = 0; i < $scope.heightConfiguration.length; i++)
						{
							$scope.heightConfiguration[i].distMode = $scope.heightGlobals.distModeGlobal;
						}
					};
					
					$scope.validateNumString = function(numString, paramName)
					{
						if (numString !== "" && isNaN(numString) === true)
						{
							alert(paramName + " must be a number");
						}
					};

					// FUNCTIONS FOR BODYGEN INTEGRATION
					$scope.saveBodyGenConfig = function() { IO.saveBodyGenConfig($scope.bodyGenConfig, patcherSettings.loadPath); };

					$scope.addAllowedRaceBodyGen = function (index) { $scope.bodyGenConfig.templates[index].allowedRaces.push(""); };
					$scope.removeAllowedRaceBodyGen = function(template, arrayIndex)
					{
						template.allowedRaces.splice(arrayIndex, 1);
					};

					$scope.addDisallowedRaceBodyGen = function (index) { $scope.bodyGenConfig.templates[index].disallowedRaces.push(""); };
					$scope.removeDisallowedRaceBodyGen = function(template, arrayIndex)
					{
						template.disallowedRaces.splice(arrayIndex, 1);
					};

					$scope.addAllowedAttributeBodyGen = function (index) { $scope.bodyGenConfig.templates[index].allowedAttributes.push(["", ""]); };
					$scope.removeAllowedAttributeBodyGen = function(template, arrayIndex)
					{
						template.allowedAttributes.splice(arrayIndex, 1);
					};

					$scope.addDisallowedAttributeBodyGen = function (index) { $scope.bodyGenConfig.templates[index].disallowedAttributes.push(["",""]); };
					$scope.removeDisallowedAttributeBodyGen = function(template, arrayIndex)
					{
						template.disallowedAttributes.splice(arrayIndex, 1);
					};

					$scope.addForceIfAttributeBodyGen = function (index) { $scope.bodyGenConfig.templates[index].forceIfAttributes.push(["", ""]); };
					$scope.removeForceIfAttributeBodyGen = function(template, arrayIndex)
					{
						template.forceIfAttributes.splice(arrayIndex, 1);
					};

					$scope.addBelongGroupBodyGen = function (index) { $scope.bodyGenConfig.templates[index].groups.push(""); };
					$scope.removeBelongGroupBodyGen = function(template, arrayIndex)
					{
						template.groups.splice(arrayIndex, 1);
					};

					$scope.addTemplateGroupBodyGen = function () 
					{ 
						$scope.bodyGenConfig.templateGroups.push("");
					};
					$scope.removeTemplateGroupBodyGen = function(arrayIndex)
					{
						$scope.bodyGenConfig.templateGroups.splice(arrayIndex, 1);
					};

					$scope.addTemplateDescriptorBodyGen = function () 
					{ 
						$scope.bodyGenConfig.templateDescriptors.push("");
					};
					
					$scope.validateTemplateDescriptorBodyGen = function(index)
					{
						let split = $scope.bodyGenConfig.templateDescriptors[index].split(":");
						if (split.length !== 2)
						{
							alert("A descriptor must have the format \"Category: Description\". Please re-enter your descriptor.");
							$scope.bodyGenConfig.templateDescriptors[index] = "";
						}
					}

					$scope.removeTemplateDescriptorBodyGen = function(arrayIndex)
					{
						$scope.bodyGenConfig.templateDescriptors.splice(arrayIndex, 1);
					};

					$scope.addBodyGenItem = function(combination) { combination.members.push("") };
					$scope.removeBodyGenItem = function(combination, index) { combination.members.splice(index, 1); };

					$scope.addBodyGenCombo = function(RGconfig) { 
						let newCombo = {};
						newCombo.members = [];
						newCombo.probabilityWeighting = 1;
						RGconfig.push(newCombo); 
					};
					$scope.removeBodyGenCombo = function(RGconfig, index) { 
						RGconfig.combinations.splice(index, 1); 
					};

					$scope.addBodyGenDescriptor = function (index) { $scope.bodyGenConfig.templates[index].descriptors.push(""); };
					$scope.removeBodyGenDescriptor = function(template, arrayIndex)
					{
						template.descriptors.splice(arrayIndex, 1);
					};

					$scope.updateBodyGenItemDisplay = function()
					{
						$scope.BodyGenItemDisplay = updateBodyGenItemDisplay($scope.bodyGenConfig);
					};

					$scope.addBodyGenFemaleConfig = function()
					{
						newcfg = {};
						newcfg.EDID = "";
						newcfg.combinations = [];
						$scope.bodyGenConfig.racialSettingsFemale.push(newcfg);
					};

					$scope.removeBodyGenFemaleConfig = function(index)
					{
						$scope.bodyGenConfig.racialSettingsFemale.splice(index, 1);
					};

					$scope.addBodyGenMaleConfig = function()
					{
						newcfg = {};
						newcfg.EDID = "";
						newcfg.combinations = [];
						$scope.bodyGenConfig.racialSettingsMale.push(newcfg);
					};

					$scope.removeBodyGenMaleConfig = function(index)
					{
						$scope.bodyGenConfig.racialSettingsMale.splice(index, 1);
					};

					$scope.setRaceMenuConfig = function()
					{
						IO.setRaceMenuConfig(xelib.GetGlobal('DataPath'));
					};

					$scope.selectBodyGenConfigFile = function()
					{
						IO.loadSelectedBodyGenConfig($scope.bodyGenConfig);
						$scope.BodyGenItemDisplay = updateBodyGenItemDisplay($scope.bodyGenConfig);
						$scope.categorizedMorphs = BGI.categorizeMorphs($scope.bodyGenConfig, $scope.raceGroupDefinitions);
					};

					$scope.selectBodyGenTemplateFile = function()
					{
						
						IO.loadSelectedBodyGenTemplate($scope.bodyGenConfig.templates);
					};
					
					$scope.selectBodyGenMorphsFile = function()
					{
						IO.loadSelectedBodyGenMorphs($scope.forcedNPCAssignments, $scope.availableNPCs, $scope.bodyGenConfig.templates);
					}

					$scope.removeBodyGenTemplate = function(index)
					{
						$scope.bodyGenConfig.templates.splice(index, 1);
					}
					
					$scope.addBodyGenTemplate = function()
					{
						$scope.bodyGenConfig.templates.push(Aux.createBodyGenTemplate());
					}

					// Functions for block list
					$scope.addNPCtoBlockList = function(currentNPC, mode)
					{
						let blockedNPC = findNPCinBlockList(currentNPC, $scope.blockList.blockedNPCs);
						if (blockedNPC === undefined)
						{
							blockedNPC = createNPCforBlockList(currentNPC, $scope.blockList.blockedNPCs);
						}

						if (mode === "all" || mode === "assets")
						{
							blockedNPC.bBlockAssets = true;
						}
						if (mode === "all" || mode === "height")
						{
							blockedNPC.bBlockHeight = true;
						}
						if (mode === "all" || mode === "bodygen")
						{
							blockedNPC.bBlockBodyGen = true;
						}
					};

					$scope.removeBlockedNPC = function(index)
					{
						$scope.blockList.blockedNPCs.splice(index, 1);
					};

					$scope.addPluginToBlockList = function(currentPlugin, mode)
					{
						let blockedPlugin = findPlugininBlockList(currentPlugin, $scope.blockList.blockedPlugins);
						if (blockedPlugin === undefined)
						{
							blockedPlugin = createPluginforBlockList(currentPlugin, $scope.blockList.blockedPlugins);
						}

						if (mode === "all" || mode === "assets")
						{
							blockedPlugin.bBlockAssets = true;
						}
						if (mode === "all" || mode === "height")
						{
							blockedPlugin.bBlockHeight = true;
						}
						if (mode === "all" || mode === "bodygen")
						{
							blockedPlugin.bBlockBodyGen = true;
						}
					};

					$scope.removeBlockedPlugin = function(index)
					{
						$scope.blockList.blockedPlugins.splice(index, 1);
					};

					$scope.saveBlockList = function()
					{
						IO.saveBlockList(patcherSettings.loadPath, $scope.blockList);
					};

					$scope.refreshFilters = function()
					{
						$scope.displayedNPCs = $scope.availableNPCs;
						$scope.displayedPlugins = $scope.loadedPlugins;
					}

					$scope.updateDisplayedNPCs = function(filter)
					{
						let lfilter = filter.toLowerCase();
						$scope.displayedNPCs = [];
						for (let i = 0; i < $scope.availableNPCs.length; i++)
						{
							if ($scope.availableNPCs[i].name.toLowerCase().includes(lfilter) || $scope.availableNPCs[i].EDID.toLowerCase().includes(lfilter))
							{
								$scope.displayedNPCs.push($scope.availableNPCs[i]);
							}
						}
					}

					$scope.updateDisplayedPlugins = function(filter)
					{
						let lfilter = filter.toLowerCase();
						$scope.displayedPlugins = [];
						for (let i = 0; i < $scope.loadedPlugins.length; i++)
						{
							if ($scope.loadedPlugins[i].toLowerCase().includes(lfilter) || $scope.availableNPCs[i].EDID.toLowerCase().includes(lfilter))
							{
								$scope.displayedPlugins.push($scope.loadedPlugins[i]);
							}
						}
					}

					$scope.toggleLoadPath = function(bLoadFromData)
					{
						switch(bLoadFromData)
						{
							case false:
								patcherSettings.loadPath = modulePath;
								break;
							case true:
								patcherSettings.loadPath = xelib.GetGlobal('DataPath') + "zEBD";
								break;
						}

						$scope.assetPackSettings = IO.loadAssetPackSettings(patcherSettings.loadPath, patcherSettings.displayAssetPackAlerts, [], false, true, false);
						$scope.heightConfiguration = IO.loadHeightConfiguration(patcherSettings.loadPath);
						$scope.bodyGenConfig = IO.loadBodyGenConfig(patcherSettings.loadPath);
						$scope.consistencyRecords = IO.loadConsistency(patcherSettings.loadPath, true);
						$scope.forcedNPCAssignments = IO.loadForceList(patcherSettings.loadPath);
						$scope.blockList = IO.loadBlockList(patcherSettings.loadPath);
					}

					$scope.saveSpecificNPCLinkages = function()
					{
						IO.saveLinkGroups(modulePath, $scope.linkGroups);
					}

					$scope.removeLinkedNPC = function(currentLinkGroup, index)
					{
						currentLinkGroup.NPCs.splice(index, 1);
					}

					$scope.addLinkGroup = function(newLinkGroupName)
					{
						let bExists = false;
						for (let i = 0; i < $scope.linkGroups.length; i++)
						{
							if ($scope.linkGroups[i].name === newLinkGroupName)
							{
								bExists = true;
								break;
							}
						}
						if (newLinkGroupName === undefined || newLinkGroupName === "")
						{
							alert("You must enter a name for this Link Group before adding it to the list.");
						}
						else if (bExists === true)
						{
							alert("A link group with name " + newLinkGroupName + " already exists.");
						}
						else
						{
							let LG = {};
							LG.name = newLinkGroupName;
							LG.NPCs = [];
							$scope.linkGroups.push(LG);
						}
					}

					$scope.addNPCtoLinkGroup = function(currentNPC, currentLinkGroup)
					{
						currentLinkGroup.NPCs.push(currentNPC);
					}
				},

				defaultSettings:
					{
						btooltips: true,
						showMiscSettings: false,
						changeNPCappearance: true,
						changeHeight: true,
						changeHeadparts: false,
						changeTextures: true,
						changeMeshes: true,
						changeNPCsWithWNAM: true,
						changeNPCsWithFaceParts: true,
						excludePC: true,
						excludePresets: true,
						changeFemaleAnimations: false,
						bEnableConsistency: true,
						bLinkNPCsWithSameName: true,
						displayAssetPackAlerts: true,
						patchFileName: 'zEBD.esp',
						bVerboseMode: false,
						bAbortIfPathWarnings: true,
						permutationBuildUpLogger: false,
						updateHeadPartNames: true,
						savePermutations: false,
						loadPermutations: false,
						bGeneratePermutationLog: true,
						changeNPCHeight: true,
						changeRaceHeight: true,
						changeNonDefaultHeight: true,
						bEnableBodyGenIntegration: false,
						bLoadFromData: false,
						loadPath: modulePath,
						bLogOnlyAssignedPermutations: false,
						patchableRaces: ["NordRace", "BretonRace", "DarkElfRace", "HighElfRace", "ImperialRace", "OrcRace", "RedguardRace", "WoodElfRace", "ElderRace", "NordRaceVampire", "BretonRaceVampire", "DarkElfRaceVampire", "HighElfRaceVampire", "ImperialRaceVampire", "OrcRaceVampire", "RedguardRaceVampire", "WoodElfRaceVampire", "ElderRaceVampire", "SnowElfRace", "DA13AfflictedRace", "KhajiitRace", "KhajiitRaceVampire", "ArgonianRace", "ArgonianRaceVampire"],
						raceAliases: []
					}
			},
		// optional array of required filenames.  can omit if empty.
		requiredFiles: [],
		getFilesToPatch: function (filenames)
		{
			return filenames;
		},
		execute: (patchFile, helpers, settings, locals) =>
			(
				{
					customProgress: function(filesToPatch)
					{
						let fileHandle;

						let NPChandles = [];
						let RNAMhandles = [];

						let NPCs = [];
						let RNAMs = [];

						for (let i = 0; i < filesToPatch.length; i++)
						{
							fileHandle = xelib.FileByName(filesToPatch[i]);
							if (xelib.HasElement(fileHandle, "Non-Player Character (Actor)"))
							{
								NPChandles = xelib.GetElements(fileHandle, "Non-Player Character (Actor)");
								for (let j = 0; j < NPChandles.length; j++)
								{
									NPCs.push(xelib.GetHexFormID(NPChandles[j]));
								}
							}
							if (xelib.HasElement(fileHandle, "RACE"))
							{
								RNAMhandles = xelib.GetElements(fileHandle, "RACE");
								for (let j = 0; j < RNAMhandles.length; j++)
								{
									RNAMs.push(xelib.GetHexFormID(RNAMhandles[j]));
								}
							}
						}

						NPCs = Aux.getArrayUniques(NPCs);
						RNAMs = Aux.getArrayUniques(RNAMs);

						return NPCs.length + RNAMs.length;
					},

					initialize: function ()
					{
						if (settings.changeTextures === false && settings.changeMeshes === false)
						{
							settings.changeNPCappearance = false;
						}

						// get alias list
						settings.raceAliasesSorted = Aux.sortRaceAliases(settings.raceAliases);
						// load info from JSON
						helpers.logMessage("Loading info from JSON settings files");
						locals.userKeywords = [];
						locals.raceGroupDefinitions = IO.loadRestrictionGroupDefs(modulePath, settings.displayAssetPackAlerts);
						locals.assetPackSettings = IO.loadAssetPackSettings(settings.loadPath, settings.displayAssetPackAlerts, locals.userKeywords, true, true, settings.bAbortIfPathWarnings);
						locals.recordTemplates = IO.loadRecordTemplates(modulePath, locals.raceGroupDefinitions, helpers.logMessage);
						locals.trimPaths = IO.loadTrimPaths(modulePath);
						locals.EBDassets = IO.loadEBDAssets(modulePath);
						locals.heightConfiguration = IO.loadHeightConfiguration(settings.loadPath);
						locals.bodyGenConfig = IO.loadBodyGenConfig(settings.loadPath);
						locals.forcedNPCAssignments = IO.loadForceList(settings.loadPath);
						locals.blockList = IO.loadBlockList(settings.loadPath);
						locals.consistencyRecords  = IO.loadConsistency(settings.loadPath, settings.bEnableConsistency);
						locals.LinkedNPCNameExclusions = IO.loadLinkedNPCNameExclusions(modulePath);
						locals.linkedNPCList = IO.loadLinkGroups(modulePath);
						locals.loadedFromJSON = false;

						// generate permutations to assign to NPCs
						if (settings.changeNPCappearance === true)
						{
							//helpers.logMessage("Generating asset permutations.");
							//locals.permutations = PG.generateAssetPackPermutations(locals.assetPackSettings, locals.raceGroupDefinitions, settings, locals.trimPaths, helpers);
							//RG.generateRecords(locals.permutations, settings, locals.recordTemplates, locals.assetPackSettings, helpers); // RG.recordTemplates and RG.maxPriority filled by reference within this function

							// create lists to narrow down permutation search space (speeds up patching)
							PG.generateFlattenedAssetPackSettings(locals.assetPackSettings, locals.raceGroupDefinitions, settings);
							locals.assetsByRaceGender = PO.generateAssetRaceGenderList(locals.assetPackSettings, settings.patchableRaces);
							//PO.linkFlattenedRequiredSubgroups(locals.assetPackSettings);

							//helpers.logMessage("Optimizing permutation distribution");
							//locals.patchableGenders = PO.generatePatchableGenderList(locals.assetPackSettings);
							//locals.permutationsByRaceGender = PG.permutationByRaceGender(locals.permutations, locals.patchableGenders, settings.patchableRaces);

							// create EDID -> FormID dictionary to speed up patching
							locals.RNAMdict = PO.generateRaceEDIDFormIDdict(helpers.loadRecords);

							// write new assets into the ESP file (new ARMO, ARMA, TXST, etc)
							helpers.logMessage("Writing core EBD records to plugin");
							locals.EBDassetDict = deserializer.deserializeMatorJSONobjects(locals.EBDassets, patchFile);
							locals.EBDeffect = locals.EBDassetDict["SP_EBD_EBDHelperScript_attacher_SPEL"]; // for the second patcher block

							locals.userKeywords = RG.convertUserKeywordsToObjects(locals.userKeywords);
							locals.userKeywordDict = deserializer.deserializeMatorJSONobjects(locals.userKeywords, patchFile);
							locals.formIDdict = Aux.combineDictionaries([locals.EBDassetDict, locals.userKeywordDict]);

							// write the generated asset records
							//helpers.logMessage("Writing the new NPC asset records to plugin");
							//PO.writeAssets(RG, patchFile, helpers.logMessage, settings.patchableRaces, locals.RNAMdict);
						}
						// set up object to store permutations
						locals.assignedPermutations = {};
						locals.assignedHeights = {};
						locals.assignedBodyGen = {};
						locals.NPCinfoDict = {};
						locals.linkedNPCpermutations = [];
						locals.linkedNPCheights = [];
						locals.linkedNPCbodygen = [];

						// fix height formats if necessary
						if (settings.changeRaceHeight === true)
						{
							Aux.padHeightConfig(locals.heightConfiguration);
						}

						if (settings.bEnableBodyGenIntegration === true)
						{
							BGI.formatMorphDescriptors(locals.bodyGenConfig.templates);
							locals.bodyGenConfig.descriptorsByGroup = BGI.getDescriptorsByGroup(locals.bodyGenConfig.templates);
							BGI.convertMorphWeightRangeToNum(locals.bodyGenConfig.templates);
							locals.BGcategorizedMorphs = BGI.categorizeMorphs(locals.bodyGenConfig, locals.raceGroupDefinitions);
						}

						//just for fun
						locals.filtered = 0;
						locals.patched = 0;
						locals.Jason = IO.loadJason(modulePath);
					}

					,
					process:
						[
							{
								load:
									{
										signature: 'NPC_',
										filter: function (record)
										{
											locals.filtered++;
											let attributeCache = {};
											let NPCinfo = PO.getNPCinfo(record, locals.consistencyRecords, xelib);

											if (NPCinfo.formID === "00000007" && settings.excludePC === true) // ignore player
											{
												helpers.addProgress(1);
												return false;
											}

											if (NPCinfo.EDID.includes("Preset") && settings.excludePresets === true) // ignore player presets
											{
												helpers.addProgress(1);
												return false;
											}

											if (settings.patchableRaces.includes(NPCinfo.race) === false) // check if NPC's race is one of the patchable races
											{
												helpers.addProgress(1);
												return false;
											}

											let NPClinkGroup = PO.findNPCinLinkedList(locals.linkedNPCList, NPCinfo);
											let userForcedAssignment = PO.getUserForcedAssignment(NPCinfo, locals.forcedNPCAssignments, NPClinkGroup);
											let userBlockedAssignment = PO.getBlocks(record, locals.blockList, NPCinfo, helpers.logMessage, xelib);

											let bApplyPermutationToCurrentNPC = settings.changeNPCappearance;
											let bApplyHeightSettingsToCurrentNPC = settings.changeNPCHeight;
											// not needed for BodyGen because no code is executed in the patch function for BodyGen assignment

											if (settings.changeNPCappearance === true)
											{
												if (userBlockedAssignment.assets === true)
												{
													bApplyPermutationToCurrentNPC = false;
												}
												else
												{
													// set race alias here to make sure an aliased NPC doesn't fail the following check
													let bRGvalid = bCheckNPCRaceGenderValidforAssets(NPCinfo, locals.assetsByRaceGender, settings.raceAliasesSorted);
													if (bRGvalid === false)
													{
														bApplyPermutationToCurrentNPC = false;
													}
													

													if (settings.changeNPCsWithWNAM === false && xelib.HasElement(record, "WNAM") === true)
													{
														helpers.logMessage("NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked because it already has a WNAM record. Skipping.");
														bApplyPermutationToCurrentNPC = false;
													}

													if (settings.changeNPCsWithFaceParts === false && Aux.bAttributeMatched("Head Parts\\*\\PNAM", "Face", record, helpers.logMessage, xelib, {}) === true)
													{
														helpers.logMessage("NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked because it has a custom face part. Skipping.");
														bApplyPermutationToCurrentNPC = false;
													}

													//if all the above don't fail, assign a permutation.
													if (bApplyPermutationToCurrentNPC === true)
													{
														locals.assignedPermutations[NPCinfo.formID] = PO.choosePermutation_BodyGen(record, NPCinfo, locals.assetPackSettings, locals.assignedBodyGen, locals.bodyGenConfig, locals.BGcategorizedMorphs, locals.consistencyRecords, settings.bEnableConsistency, settings.bEnableBodyGenIntegration, userForcedAssignment, userBlockedAssignment, settings.bLinkNPCsWithSameName, locals.LinkedNPCNameExclusions, locals.linkedNPCpermutations, locals.linkedNPCbodygen, NPClinkGroup, settings.raceAliasesSorted, attributeCache, helpers.logMessage);
													}
													if (locals.assignedPermutations[NPCinfo.formID] === undefined) // occurs if the NPC is incompatible with the assignment criteria for all generated permutations.
													{
														bApplyPermutationToCurrentNPC = false;
													}
												}
											}

											if (settings.changeNPCHeight === true)
											{
												if (userBlockedAssignment.height === true)
												{
													bApplyHeightSettingsToCurrentNPC = false;
												}
												else
												{
													locals.assignedHeights[NPCinfo.formID] = PO.assignNPCheight(record, NPCinfo, settings.bEnableConsistency, locals.consistencyRecords, locals.heightConfiguration, userForcedAssignment, settings.changeNonDefaultHeight, settings.bLinkNPCsWithSameName, locals.LinkedNPCNameExclusions, locals.linkedNPCheights, NPClinkGroup, settings.raceAliasesSorted, helpers.logMessage);
													if (locals.assignedHeights[NPCinfo.formID] === undefined || locals.assignedHeights[NPCinfo.formID] === "NaN") // if there are no height settings for the given NPC's race
													{
														bApplyHeightSettingsToCurrentNPC = false;
													}
												}
											}
											
											if (settings.bEnableBodyGenIntegration === true && userBlockedAssignment.bodygen === false)
											{
												// Assign BodyGen morphs if they haven't already been assigned by PO.choosePermutation_BodyGen(...)
												if (locals.assignedBodyGen[NPCinfo.formID] === undefined)
												{
													let chosenMorph = BGI.assignMorphs(record, locals.bodyGenConfig, locals.BGcategorizedMorphs, NPCinfo, settings.bEnableConsistency, locals.consistencyRecords, undefined, userForcedAssignment, settings.bLinkNPCsWithSameName, locals.linkedNPCbodygen, NPClinkGroup, false, settings.raceAliasesSorted, attributeCache, helpers.logMessage, {});
													if (chosenMorph !== undefined)
													{
														locals.assignedBodyGen[NPCinfo.formID] = chosenMorph;
													}
												}

												// store morphs assigned by either PO.choosePermutation_BodyGen(...) or BGI.assignMorphs(...) if they were assigned successfully
												if (locals.assignedBodyGen[NPCinfo.formID] !== undefined)
												{
													BGI.updateLinkedBodyGenData(locals.assignedBodyGen[NPCinfo.formID], settings.bLinkNPCsWithSameName, NPCinfo, locals.LinkedNPCNameExclusions, locals.linkedNPCbodygen, NPClinkGroup);

													//handle BodyGen consistency here. Because BGI.assignMorphs() can get called multiple times within PO.choosePermutation_BodyGen(), wait until the final morphs are selected before storing them in consistency. This way, if choosePermutation_BodyGen() fails to generate a valid morph, the original consistency morph can still be drawn by BGI.assignMorphs()
													if (settings.bEnableConsistency === true)
													{
														BGI.updateBodyGenConsistencyRecord(locals.assignedBodyGen[NPCinfo.formID], record, NPCinfo, locals.consistencyRecords, xelib);
													}
												}
											}

											// store the NPC info
											locals.NPCinfoDict[NPCinfo.formID] = NPCinfo; // can't store it using the handle as key because the handle changes from filter() to patch()

											if (bApplyPermutationToCurrentNPC === false && bApplyHeightSettingsToCurrentNPC === false)
											{
												helpers.addProgress(1);
												return false;
											}

											helpers.addProgress(0.75);
											return true;
										}
									},
								patch: function (record)
								{
									helpers.addProgress(0.25);
									let NPCformID = xelib.GetHexFormID(record);
									
									if (settings.changeNPCappearance === true && locals.assignedPermutations[NPCformID] !== undefined)
									{
										PO.applyPermutation(record, locals.assignedPermutations[NPCformID], locals.formIDdict, settings.updateHeadPartNames, xelib, helpers.copyToPatch, RG.recordTemplates);
									}
									
									if (settings.changeNPCHeight === true && locals.assignedHeights[NPCformID] !== undefined && locals.assignedHeights[NPCformID] !== NaN && locals.assignedHeights[NPCformID] !== NaN) // NaN and NaN are catch-alls in case of manual editing and misconfiguring of consistency file
									{
										xelib.SetValue(record, "NAM6 - Height", locals.assignedHeights[NPCformID]);
									}
									
									locals.patched++;
									jasonSays(locals.patched / locals.filtered, helpers.logMessage, locals.Jason);
								}
							},
							{
								load:
									{
										signature: 'RACE',
										filter: function (record)
										{
											locals.filtered++;
											let raceEDID = xelib.EditorID(record);
											if(settings.patchableRaces.includes(raceEDID))
											{
												return true;
											}
											else
											{
												helpers.addProgress(1);
												return false;
											}
										}
									},
								patch: function (record)
								{
									let raceEDID = xelib.EditorID(record);
									if (settings.changeNPCappearance === true)
									{
										xelib.AddArrayItem(record, "Actor Effects", "", locals.EBDeffect);
									}

									if (settings.changeRaceHeight === true && Aux.heightConfigIncludesRace(locals.heightConfiguration, raceEDID))
									{
										PO.patchRaceHeight(record, raceEDID, locals.heightConfiguration)
									}

									helpers.addProgress(1);
									locals.patched++;
									jasonSays(locals.patched / locals.filtered, helpers.logMessage, locals.Jason);
								}
							}
						],
					finalize: function ()
					{
						if (settings.bEnableConsistency === true)
						{
							IO.saveConsistency(settings.loadPath, locals.consistencyRecords);
						}
						
						if (settings.bVerboseMode === true)
						{
							IO.logVerbose("", true);
						}

						if (settings.changeNPCappearance === true && settings.bGeneratePermutationLog === true)
						{
							IO.generatePermutationLog(locals.permutations, logDir, RG.recordTemplates, settings.bLogOnlyAssignedPermutations);
						}

						if (settings.bEnableBodyGenIntegration === true)
						{
							IO.generateBodyGenMorphs(locals.assignedBodyGen, locals.bodyGenConfig.templates, xelib.GetGlobal('DataPath'), settings.patchFileName);
						}

						jasonSays(-1, helpers.logMessage, locals.Jason);
					}
				}
			)


	});
});

function bCheckNPCRaceGenderValidforAssets(NPCinfo, assetsByRaceGender, raceAliasesSorted)
{	
	if (assetsByRaceGender[NPCinfo.gender] === undefined)
	{
		Aux.revertAliasRace(NPCinfo);
		return false;
	}

	Aux.setAliasRace(NPCinfo, raceAliasesSorted, "assets");

	// get rid of NPCs whose race and gender appear in permutations, but not in combination (e.g. argonian females when asset packs for humanoid females & male argonians are installed)
	if (assetsByRaceGender[NPCinfo.gender].includes(NPCinfo.race) === false)
	{
		return false;
	}

	Aux.revertAliasRace(NPCinfo);
	return true;
}

function jasonSays (fraction, logMessage, jason)
{
	let index;
	if(jason !== undefined && fraction === -1)
	{
		index = Math.floor(Math.random()*jason.last.length);
		logMessage(jason.last[index]);
	}
	else if (jason !== undefined && Math.random() < jason.frequency)
	{
		let toServe;
		if (fraction < .33)
		{
			toServe = jason.early;
		} else if (fraction < 0.66)
		{
			toServe = jason.middle;
		} else
		{
			toServe = jason.late;
		}

		index = Math.floor(Math.random()*toServe.length);

		logMessage(toServe[index]);

		toServe.splice(index, 1);		
	}

}

function updateBodyGenItemDisplay(bodyGenConfig)
{
	let items = [];

	for (let i = 0; i < bodyGenConfig.templateGroups.length; i++)
	{
		items.push(bodyGenConfig.templateGroups[i]);
	}

	return items;
}

function generateAvailableAssetPacks(assetPacks)
{
	let packs = {};
	packs.male = [];
	packs.female = [];
	packs.malenames = [];
	packs.femalenames = [];

	let obj = {};
	for (let i = 0; i < assetPacks.length; i++)
	{
		obj = {};
		obj.name = assetPacks[i].groupName;
		obj.gender = assetPacks[i].gender;
		obj.subgroups = [];
		getAllSubgroups(assetPacks[i].subgroups, obj.subgroups, assetPacks[i].subgroups);

		switch(obj.gender)
		{
			case "male":
				packs.male.push(obj);
				packs.malenames.push(obj.name);
				break;
			case "female":
				packs.female.push(obj);
				packs.femalenames.push(obj.name);
				break;
		}
	}

	return packs;
}

function getAllSubgroups(subgroupArray, allSubgroupsList, topLevelSubgroups)
{
	for (let i = 0; i < subgroupArray.length; i++)
	{
		let obj = {};
		obj.id = subgroupArray[i].id;
		obj.description = subgroupArray[i].id + ": " + subgroupArray[i].name;
		obj.topLevelSubgroup = Aux.getTopLevelSubgroup(topLevelSubgroups, subgroupArray[i].id);
		allSubgroupsList.push(obj);
		getAllSubgroups(subgroupArray[i].subgroups, allSubgroupsList, topLevelSubgroups);
	}
}

function initializeRGmembers(inputArray)
{
	let outputArray = [];
	for (let i = 0; i < inputArray.length; i++)
	{
		outputArray.push(false);
	}
	return outputArray;
}

function updateAvailableRacesAndGroups(races, groups)
{
	let dispList = [];

	for (let i = 0; i < groups.length; i++)
	{
		dispList.push(groups[i].name);
	}

	for (let i = 0; i < races.length; i++)
	{
		dispList.push(races[i]);
	}

	return dispList;
}

function findNPCAssignmentIndex(consistencyRecords, NPCinfo)
{
    let index = -1;
    let NPCsignature = NPCinfo.formID.substring(2, 9);

    for (let i = 0; i < consistencyRecords.length; i++)
    {
        if (consistencyRecords[i].rootPlugin === NPCinfo.rootPlugin && consistencyRecords[i].formIDSignature === NPCsignature)
        {
            index = i;
            break;
        }
    }
    return index;
}

function findNPCinBlockList(currentNPC, BlockedNPCs)
{
	for (let i = 0; i < BlockedNPCs.length; i++)
	{
		if (BlockedNPCs[i].formID === currentNPC.formID && BlockedNPCs[i].rootPlugin === currentNPC.rootPlugin)
		{
			return BlockedNPCs[i];
		}
	}
	return undefined;
}

function createNPCforBlockList(currentNPC, BlockedNPCs)
{
	let obj = {};
	obj.name = currentNPC.name;
	obj.formID = currentNPC.formID;
	obj.formID = "xx" + obj.formID.substring(2, 9);
	obj.EDID = currentNPC.EDID;
	obj.rootPlugin = currentNPC.rootPlugin;
	obj.displayString = obj.name + " (" + obj.formID + ") | " + obj.rootPlugin;
	obj.bBlockAssets = false;
	obj.bBlockHeight = false;
	obj.bBlockBodyGen = false;

	BlockedNPCs.push(obj);
	return obj;
}

function findPlugininBlockList(currentPlugin, BlockedPlugins)
{
	for (let i = 0; i < BlockedPlugins.length; i++)
	{
		if (BlockedPlugins[i].name === currentPlugin)
		{
			return BlockedPlugins[i];
		}
	}
	return undefined;
}

function createPluginforBlockList(currentPlugin, BlockedPlugins)
{
	let obj = {};
	obj.name = currentPlugin;
	obj.bBlockAssets = false;
	obj.bBlockHeight = false;
	obj.bBlockBodyGen = false;
	BlockedPlugins.push(obj);
	return obj;
}

function getBlankLinkGroup()
{
	let obj = {};
	obj.name = "";
	obj.NPCs = [];
}

ngapp.directive('displaySubgroups', function()
{
	return {
		restrict: 'E',
		scope: {
			data: '=',
			bgintegration: '=',
			bgdescriptors: '=',
			racesandgroups: '=',
			btooltips: '='
		},
		templateUrl: `${moduleUrl}/partials/subGroupTemplateDirective.html`,
		controller: 'subgroupController'
	};
});

ngapp.controller('subgroupController', function($scope)
{
	$scope.addSubgroup = function(index)
	{
		$scope.data[index].subgroups.push({
			id: 'defaultId',
			enabled: true,
			distributionEnabled: true,
			allowedRaces: [],
			disallowedRaces: [],
			allowedAttributes: [],
			disallowedAttributes: [],
			forceIfAttributes: [],
			allowUnique: true,
			allowNonUnique: true,
			name: 'Default Name',
			requiredSubgroups: [],
			excludedSubgroups: [],
			addKeywords: [],
			probabilityWeighting: 1,
			paths: [],
			subgroups: []
		});
	}

	$scope.removeSubgroup = function(index)
	{
		$scope.data.splice(index, 1);
	}

	$scope.addAllowedRace = function (index) { $scope.data[index].allowedRaces.push(""); }
	$scope.removeAllowedRace = function(subgroup, arrayIndex)
	{
		subgroup.allowedRaces.splice(arrayIndex, 1);
	}

	$scope.addDisallowedRace = function (index) { $scope.data[index].disallowedRaces.push("");}
	$scope.removeDisallowedRace = function(subgroup, arrayIndex) {subgroup.disallowedRaces.splice(arrayIndex, 1);}

	$scope.addAllowedAttribute = function (index) { $scope.data[index].allowedAttributes.push(["",""]);}
	$scope.removeAllowedAttribute = function(subgroup, arrayIndex) {subgroup.allowedAttributes.splice(arrayIndex, 1);}

	$scope.addDisallowedAttribute = function (index) { $scope.data[index].disallowedAttributes.push(["",""]);}
	$scope.removeDisallowedAttribute = function(subgroup, arrayIndex) {subgroup.disallowedAttributes.splice(arrayIndex, 1);}

	$scope.addForceIfAttribute = function (index) { $scope.data[index].forceIfAttributes.push(["",""]);}
	$scope.removeForceIfAttribute = function(subgroup, arrayIndex) {subgroup.forceIfAttributes.splice(arrayIndex, 1);}

	$scope.addRequiredSubgroup = function (index) { $scope.data[index].requiredSubgroups.push("");}
	$scope.removeRequiredSubgroup = function(subgroup, arrayIndex) {subgroup.requiredSubgroups.splice(arrayIndex, 1);}

	$scope.addExcludedSubgroup = function (index) { $scope.data[index].excludedSubgroups.push("");}
	$scope.removeExcludedSubgroup = function(subgroup, arrayIndex) {subgroup.excludedSubgroups.splice(arrayIndex, 1);}

	$scope.addAddKeywords = function (index) { $scope.data[index].addKeywords.push("");}
	$scope.removeAddKeywords = function(subgroup, arrayIndex) {subgroup.addKeywords.splice(arrayIndex, 1);}

	$scope.addPath = function (index) { $scope.data[index].paths.push(["",""]);}
	$scope.removePath = function(subgroup, arrayIndex) {subgroup.paths.splice(arrayIndex, 1);}

	$scope.addAllowedBodyGenDescriptor = function (index) { $scope.data[index].allowedBodyGenDescriptors.push("");}
	$scope.removeAllowedBodyGenDescriptor = function(subgroup, arrayIndex) {subgroup.allowedBodyGenDescriptors.splice(arrayIndex, 1);}

	$scope.addDisallowedBodyGenDescriptor = function (index) { $scope.data[index].disallowedBodyGenDescriptors.push("");}
	$scope.removeDisallowedBodyGenDescriptor = function(subgroup, arrayIndex) {subgroup.disallowedBodyGenDescriptors.splice(arrayIndex, 1);}

	$scope.handleDrop = function(e){
        e.preventDefault();
        e.stopPropagation();
        let files = e.dataTransfer.files;
        $scope.data[subgroupIndex].paths.push(...files);
    };
})

ngapp.directive('droppable', function () {
	return {
	  restrict: 'A',
	  link: function (scope, element, attrs) {
		element[0].addEventListener('drop', scope.handleDrop, false);
	  }
	}
  });