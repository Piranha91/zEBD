debugger;
let logDir = modulePath + "\\Logs";
let IO = require(modulePath + '\\lib\\IO.js')(logDir, fh, modulePath);
let Aux = require(modulePath + '\\lib\\Auxilliary');
let PG = require(modulePath + '\\lib\\PermutationGenerator.js')(logDir, fh);
let RG = require(modulePath + '\\lib\\RecordGenerator.js')(logDir, fh);
let deserializer = require(modulePath + "\\lib\\ObjectToRecord.js")(logDir, fh, xelib);
let PO = require(modulePath + '\\lib\\PatcherOps.js')(logDir, fh, xelib);
let BGI = require(modulePath + '\\lib\\BodyGenIntegration.js')(Aux, PO);

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
					$scope.assetPackSettings = IO.loadAssetPackSettings(modulePath, patcherSettings.displayAssetPackAlerts, [], false, true, false);
					$scope.raceGroupDefinitions = IO.loadRestrictionGroupDefs(modulePath, patcherSettings.displayAssetPackAlerts);
					$scope.heightPresets = IO.loadHeightPresets(modulePath);
					$scope.heightConfiguration = IO.loadHeightConfiguration(modulePath);
					$scope.bodyGenConfig = IO.loadBodyGenConfig(modulePath);
					$scope.trimPaths = IO.loadTrimPaths(modulePath);
					$scope.LinkedNPCNameExclusions = IO.loadLinkedNPCNameExclusions(modulePath);
					
					$scope.BodyGenItemDisplay = updateBodyGenItemDisplay($scope.bodyGenConfig);
					$scope.allAssetPacks = generateAvailableAssetPacks($scope.assetPackSettings);
					$scope.availableAssetPacks = [];
					$scope.availableAssetPackNames = [];
					$scope.availableSubgroups = [];
					$scope.loadedPlugins = xelib.GetLoadedFileNames(true);
					$scope.consistencyAssignments = IO.loadConsistency(modulePath, true);

					$scope.forcedNPCAssignments = IO.loadForceList(modulePath);
					$scope.blockList = IO.loadBlockList(modulePath);

					if (patcherSettings.bVerboseMode === true)
					{
						IO.logVerbose("", true);
					};

					$scope.genderOptions = ["male", "female"];
					$scope.heightDistOptions = ["uniform", "bell curve"];
					$scope.heightGlobals = { distModeGlobal: 'uniform', heightRangeGlobal: "0.020000", currentHeightPreset: undefined };
					$scope.bodyGenBool = ["AND", "OR"];
					$scope.availableNPCs = fh.loadJsonFile(modulePath + "\\zEBD assets\\Base NPC List\\NPClist.json");
					$scope.currentNPC = {};
					$scope.currentPlugin = "";
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
						IO.saveForceList(modulePath, $scope.forcedNPCAssignments);
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
									NPC.displayString = NPC.name + " | " + NPC.EDID + " | " + NPC.formID + " | " + NPC.race + " | " + NPC.masterRecordFile;
									$scope.availableNPCs.push(NPC);
								}
							}
						}
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

					$scope.removeNPCinfoFromConsistency = function(currentNPC, mode)
					{
						if ($scope.consistencyAssignments === undefined || $scope.consistencyAssignments === null || $scope.consistencyAssignments.length === 0)
						{
							alert("No consistency file found.");
							return;
						}

						currentNPC.consistencyIndex = findNPCAssignmentIndex($scope.consistencyAssignments, currentNPC);

						if (currentNPC.consistencyIndex > -1)
						{
							switch(mode)
							{
								case "assets":
									if ($scope.consistencyAssignments[currentNPC.consistencyIndex].assignedAssetPack !== undefined)
									{
										delete $scope.consistencyAssignments[currentNPC.consistencyIndex].assignedAssetPack;
									}
									if ($scope.consistencyAssignments[currentNPC.consistencyIndex].assignedPermutation !== undefined)
									{
										delete $scope.consistencyAssignments[currentNPC.consistencyIndex].assignedPermutation;
									}
									break;
								case "height":
									if ($scope.consistencyAssignments[currentNPC.consistencyIndex].height !== undefined)
									{
										delete $scope.consistencyAssignments[currentNPC.consistencyIndex].height;
									}
									break;
								case "bodygen":
									if ($scope.consistencyAssignments[currentNPC.consistencyIndex].assignedMorphs !== undefined)
									{
										delete $scope.consistencyAssignments[currentNPC.consistencyIndex].assignedMorphs;
									}
									if ($scope.consistencyAssignments[currentNPC.consistencyIndex].assignedGroups !== undefined)
									{
										delete $scope.consistencyAssignments[currentNPC.consistencyIndex].assignedGroups;
									}
									break;
							}

							IO.saveConsistency(modulePath, $scope.consistencyAssignments);
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
						let bParsedSuccessfully = IO.validatePackSettings(packSetting, true, pathWarnings, []);
						IO.warnUserAboutPaths(pathWarnings);

						if (bParsedSuccessfully === true)
						{
							IO.saveAssetPackSettings(packSetting, modulePath);
						}
						else
						{
							alert("There is a problem with your current settings. Please see Logs\\zEBDerrors.txt\nYour settings were not saved.")
						}
					};

					$scope.validateAssetPackSettings = function()
					{
						let pathWarnings = [];
						let bParsedSuccessfully = true;
						for (let i = 0; i < $scope.assetPackSettings.length; i++)
						{
							if (IO.validatePackSettings($scope.assetPackSettings[i], true, pathWarnings, []) === false)
							{
								alert("There is a problem with settings file " + $scope.assetPackSettings[i].groupName + ". Please see Logs\\zEBDerrors.txt");
								bParsedSuccessfully = false;
							}
						}
						IO.warnUserAboutPaths(pathWarnings);

						if (bParsedSuccessfully === true && pathWarnings.length === 0)
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

					$scope.clearConsistency = function()
					{
						if (confirm("Are you sure you want to delete your consistency file? Your current consistency settings will be backed up."))
						{
							IO.deleteConsistency(modulePath);
						}
					};

					$scope.deleteSavedPermutations = function()
					{
						IO.deleteSavedPermutationsRecords(modulePath);
					}

					// FUNCTIONS FOR HEIGHT CONFIGURATION
					$scope.saveHeightConfig = function()
					{
						IO.saveHeightConfiguration(modulePath, $scope.heightConfiguration);
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
					
					$scope.validateHeightString = function(heightString)
					{
						if (heightString !== "" && isNaN(heightString) === true)
						{
							alert("Height must be a number");
						}
					};

					// FUNCTIONS FOR BODYGEN INTEGRATION
					$scope.saveBodyGenConfig = function() { IO.saveBodyGenConfig($scope.bodyGenConfig); };

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
					};

					$scope.selectBodyGenTemplateFile = function()
					{
						
						IO.loadSelectedBodyGenTemplate($scope.bodyGenConfig.templates);
					};
					
					$scope.selectBodyGenMorphsFile = function()
					{
						IO.loadSelectedBodyGenMorphs($scope.forcedNPCAssignments, $scope.availableNPCs, $scope.bodyGenConfig.templates);
					}

					$scope.addNPCtoBlockList = function(currentNPC)
					{
						let obj = {};
						obj.name = currentNPC.name;
						obj.formID = currentNPC.formID;
						obj.formID = "xx" + obj.formID.substring(2, 9);
						obj.EDID = currentNPC.EDID;
						obj.rootPlugin = currentNPC.masterRecordFile;
						obj.displayString = obj.name + " (" + obj.formID + ") | " + obj.rootPlugin;

						let bFound = false;
						for (let i = 0; i < $scope.blockList.blockedNPCs.length; i++)
						{
							let matchedFormID = ($scope.blockList.blockedNPCs[i].formID === obj.formID);
							let matchedPlugin = ($scope.blockList.blockedNPCs[i].rootPlugin === obj.rootPlugin);
							if (matchedFormID && matchedPlugin)
							{
								bFound = true;
								break;
							}
						}
						if (bFound === false)
						{
							$scope.blockList.blockedNPCs.push(obj);
						}
					};

					$scope.removeBlockedNPC = function(index)
					{
						$scope.blockList.blockedNPCs.splice(index, 1);
					};

					$scope.addPluginToBlockList = function(plugin)
					{
						$scope.blockList.blockedPlugins.push(plugin);
					};

					$scope.removeBlockedPlugin = function(index)
					{
						$scope.blockList.blockedPlugins.splice(index, 1);
					};

					$scope.saveBlockList = function()
					{
						IO.saveBlockList(modulePath, $scope.blockList);
					};
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
						patchableRaces: ["NordRace", "BretonRace", "DarkElfRace", "HighElfRace", "ImperialRace", "OrcRace", "RedguardRace", "WoodElfRace", "ElderRace", "NordRaceVampire", "BretonRaceVampire", "DarkElfRaceVampire", "HighElfRaceVampire", "ImperialRaceVampire", "OrcRaceVampire", "RedguardRaceVampire", "WoodElfRaceVampire", "ElderRaceVampire", "SnowElfRace", "DA13AfflictedRace", "KhajiitRace", "KhajiitRaceVampire", "ArgonianRace", "ArgonianRaceVampire"]
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

						// load info from JSON
						helpers.logMessage("Loading info from JSON settings files");
						locals.userKeywords = [];
						locals.raceGroupDefinitions = IO.loadRestrictionGroupDefs(modulePath, settings.displayAssetPackAlerts);
						locals.assetPackSettings = IO.loadAssetPackSettings(modulePath, settings.displayAssetPackAlerts, locals.userKeywords, true, true, settings.bAbortIfPathWarnings);
						locals.recordTemplates = IO.loadRecordTemplates(modulePath, locals.raceGroupDefinitions);
						locals.trimPaths = IO.loadTrimPaths(modulePath);
						locals.EBDassets = IO.loadEBDAssets(modulePath);
						locals.heightConfiguration = IO.loadHeightConfiguration(modulePath);
						locals.bodyGenConfig = IO.loadBodyGenConfig(modulePath);
						locals.forcedNPCAssignments = IO.loadForceList(modulePath);
						locals.blockList = IO.loadBlockList(modulePath);
						locals.consistencyAssignments  = IO.loadConsistency(modulePath, settings.bEnableConsistency);
						locals.LinkedNPCNameExclusions = IO.loadLinkedNPCNameExclusions(modulePath);

						// generate permutations to assign to NPCs
						if (settings.changeNPCappearance === true)
						{
							if (settings.loadPermutations === true)
							{
								locals.permutations = IO.loadGeneratedPermutations(modulePath);
								RG.recordTemplates = IO.loadGeneratedRecords(modulePath);
								RG.maxPriority = IO.loadGeneratedRecordsMaxPriority(modulePath);	
							}

							if (settings.loadPermutations === false || locals.permutations === undefined || RG.recordTemplates === undefined || RG.maxPriority === undefined || locals.permutations.length === 0 || RG.recordTemplates.length === 0)
							{
								helpers.logMessage("Generating asset permutations.");
								locals.permutations = PG.generateAssetPackPermutations(locals.assetPackSettings, locals.raceGroupDefinitions, settings, locals.trimPaths, helpers);
								RG.generateRecords(locals.permutations, settings, locals.recordTemplates, helpers); // RG.recordTemplates and RG.maxPriority filled by reference within this function

								locals.loadedFromJSON = false;
							}
							else // link permutations load from JSON to records loaded from JSON
							{
								RG.linkPermutationsToJSONRecords(locals.permutations, RG.recordTemplates, helpers.logMessage);
								locals.loadedFromJSON = true;
							}

							if (settings.savePermutations === true && locals.permutations.length > 0 && RG.recordTemplates.length > 0 && locals.loadedFromJSON === false)
							{
								helpers.logMessage("Saving permutations and records to JSON");
								IO.saveGeneratedPermutations(modulePath, locals.permutations);
								IO.saveGeneratedRecords(modulePath, RG.recordTemplates, RG.linkageList, RG.maxPriority);
							}

							// create lists to narrow down permutation search space (speeds up patching)
							helpers.logMessage("Optimizing permutation distribution");
							locals.patchableGenders = PO.generatePatchableGenderList(locals.permutations);
							locals.permutationsByRaceGender = PG.permutationByRaceGender(locals.permutations, locals.patchableGenders, settings.patchableRaces);

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
							helpers.logMessage("Writing the new NPC asset records to plugin");
							PO.writeAssets(RG, patchFile, helpers.logMessage, settings.patchableRaces, locals.RNAMdict);
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
											let NPCinfo = PO.getNPCinfo(record, locals.consistencyAssignments, xelib);
											let userForcedAssignment = PO.getUserForcedAssignment(NPCinfo, locals.forcedNPCAssignments);

											if (NPCinfo.formID === "00000007") // ignore player because player isn't updated by the script.
											{
												helpers.addProgress(1);
												return false;
											}

											let bApplyPermutationToCurrentNPC = settings.changeNPCappearance;
											let bApplyHeightSettingsToCurrentNPC = settings.changeNPCHeight;

											if (settings.changeNPCappearance === true)
											{
												let bRGvalid = bCheckNPCRaceGenderValid(NPCinfo, settings.patchableRaces, locals.patchableGenders, locals.permutationsByRaceGender);
												if (bRGvalid === false)
												{
													bApplyPermutationToCurrentNPC = false;
												}

												if (PO.bNPCisBlocked(locals.blockList.blockedNPCs, NPCinfo) === true)
												{
													helpers.logMessage("NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked by ID in BlockList.json. Skipping.");
													bApplyPermutationToCurrentNPC = false;
												}

												let winningOverrideHandle = xelib.GetWinningOverride(record);
												let ORfileName = xelib.GetFileName(xelib.GetElementFile(winningOverrideHandle));
												if (locals.blockList.blockedPlugins.includes(ORfileName))
												{
													helpers.logMessage("NPC " + NPCinfo.name + " (" + NPCinfo.EDID + "/" + NPCinfo.formID + ") was blocked by plugin (" + ORfileName + ") in BlockList.json. Skipping.");
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
													locals.assignedPermutations[NPCinfo.formID] = PO.choosePermutation(record, NPCinfo, locals.permutationsByRaceGender, locals.consistencyAssignments, settings.bEnableConsistency, userForcedAssignment, settings.bLinkNPCsWithSameName, locals.linkedNPCpermutations, locals.LinkedNPCNameExclusions, attributeCache, helpers.logMessage);
												}
												if (locals.assignedPermutations[NPCinfo.formID] === undefined) // occurs if the NPC is incompatible with the assignment criteria for all generated permutations.
												{
													bApplyPermutationToCurrentNPC = false;
												}
											}

											if (settings.changeNPCHeight === true)
											{
												locals.assignedHeights[NPCinfo.formID] = PO.assignNPCheight(record, NPCinfo, settings.bEnableConsistency, locals.consistencyAssignments, settings.heightConfiguration, userForcedAssignment, settings.changeNonDefaultHeight, settings.bLinkNPCsWithSameName, locals.LinkedNPCNameExclusions, locals.linkedNPCheights);
												if (locals.assignedHeights[NPCinfo.formID] === undefined) // if there are no height settings for the given NPC's race
												{
													bApplyHeightSettingsToCurrentNPC = false;
												}
											}

											// store the NPC info
											locals.NPCinfoDict[NPCinfo.formID] = NPCinfo; // can't store it using the handle as key because the handle changes from filter() to patch()

											if (bApplyPermutationToCurrentNPC === false && bApplyHeightSettingsToCurrentNPC === false)
											{
												helpers.addProgress(1);
												return false;
											}

											if (settings.bEnableBodyGenIntegration === true)
											{
												let genMorph = BGI.assignMorphs(record, locals.bodyGenConfig, locals.BGcategorizedMorphs, NPCinfo, settings.bEnableConsistency, locals.consistencyAssignments, locals.assignedPermutations[NPCinfo.formID], userForcedAssignment, attributeCache, helpers.logMessage);
												if (genMorph !== undefined)
												{
													locals.assignedBodyGen[NPCinfo.formID] = genMorph;
												}
											}

											return true;
										}
									},
								patch: function (record)
								{
									helpers.addProgress(1);
									let NPCformID = xelib.GetHexFormID(record);
									
									if (settings.changeNPCappearance === true && locals.assignedPermutations[NPCformID] !== undefined)
									{
										PO.applyPermutation(record, locals.assignedPermutations[NPCformID], locals.formIDdict, settings.updateHeadPartNames, xelib, helpers.copyToPatch);
									}
									
									if (settings.changeNPCHeight === true && locals.assignedHeights[NPCformID] !== undefined)
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
							IO.saveConsistency(modulePath, locals.consistencyAssignments);
						}
						
						if (settings.bVerboseMode === true)
						{
							IO.logVerbose("", true);
						}

						if (settings.changeNPCappearance === true && settings.bGeneratePermutationLog === true)
						{
							IO.generatePermutationLog(locals.permutations, logDir);
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

function bCheckNPCRaceGenderValid(NPCinfo, patchableRaces, patchableGenders, permutationsByRaceGender)
{
	if (patchableRaces.includes(NPCinfo.race) === false) // check if NPC's race is one of the patchable races
	{
		return false;
	}

	if (patchableGenders.includes(NPCinfo.gender) === false)
	{
		return false;
	}

	// get rid of NPCs whose race and gender appear in permutations, but not in combination (e.g. argonian females when asset packs for humanoid females & male argonians are installed)
	for (let i = 0; i < permutationsByRaceGender.length; i++)
	{
		if (permutationsByRaceGender[i].race === NPCinfo.race && permutationsByRaceGender[i].gender === NPCinfo.gender)
		{
			if (permutationsByRaceGender[i].permutations.length === 0)
			{
				return false
			}
			else
			{
				break;
			}
		}
	}
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
        if (consistencyRecords[i].rootPlugin === NPCinfo.masterRecordFile && consistencyRecords[i].formIDSignature === NPCsignature)
        {
            index = i;
            break;
        }
    }
    return index;
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