'use strict';

angular.module('oncokbApp')
    .controller('GeneCtrl', ['_', 'S', '$resource', '$interval', '$timeout', '$scope', '$rootScope', '$location', '$route', '$routeParams', '$window', '$q', 'dialogs', 'OncoKB', 'gapi', 'DatabaseConnector', 'SecretEmptyKey', '$sce', 'jspdf', 'FindRegex', 'stringUtils', 'mainUtils', 'ReviewResource', 'loadFiles', '$firebaseObject', '$firebaseArray', 'FirebaseModel', 'user',
        function (_, S, $resource, $interval, $timeout, $scope, $rootScope, $location, $route, $routeParams, $window, $q, dialogs, OncoKB, gapi, DatabaseConnector, SecretEmptyKey, $sce, jspdf, FindRegex, stringUtils, mainUtils, ReviewResource, loadFiles, $firebaseObject, $firebaseArray, FirebaseModel, user) {
            $window.onbeforeunload = function (event) {
                var myName = $rootScope.me.name.toLowerCase();
                var genesOpened = _.without($rootScope.meta.collaborators[myName], $scope.fileTitle);
                firebase.database().ref('Meta/collaborators/' + myName).set(genesOpened).then(function (result) {
                    console.log('success');
                }).catch(function (error) {
                    console.log(error);
                });
            }
            function isValidVariant(originalVariantName) {
                var variantName = originalVariantName.trim().toLowerCase();
                var validMutation = true;
                var message = originalVariantName + ' ';
                var mutationNameBlackList = [
                    'activating mutations',
                    'activating mutation',
                    'inactivating mutations',
                    'inactivating mutation'
                ];
                if (mutationNameBlackList.indexOf(variantName) !== -1) {
                    validMutation = false;
                    message += 'is a not allowed name!';
                }
                if (validMutation) {
                    _.some($scope.mutations, function (mutation) {
                        if (mutation.name.toLowerCase() === variantName) {
                            validMutation = false;
                            message += 'has already been added in the mutation section!';
                            return true;
                        }
                    });
                }
                if (validMutation) {
                    _.some($scope.vusFire.vus, function (vusItem) {
                        if (vusItem.name.toLowerCase() === variantName) {
                            validMutation = false;
                            message += 'has already been added in the VUS section!';
                            return true;
                        }
                    });
                }
                // To be dealt with in the Review mode related refactor
                // dialogs.notify('Warning', 'This mutation just got removed, we will reuse the old one.');
                if (!validMutation) {
                    dialogs.notify('Warning', message);
                }
                return validMutation;
            }
            $scope.addMutation = function (newMutationName) {
                if (isValidVariant(newMutationName)) {
                    var mutation = new FirebaseModel.Mutation(newMutationName);
                    mutation.name_review = {
                        updatedBy: $rootScope.me.name,
                        updateTime: new Date().getTime(),
                        added: true
                    };
                    if (!$scope.gene.mutations) {
                        $scope.gene.mutations = [mutation];
                    } else {
                        $scope.gene.mutations.push(mutation);
                    }
                }
            };
            /**
             * This function is used to calculate 2 types of mutation messages we want to indicate in the mutation section header.
             * The first one is about the mutation name validation result such as duplicated mutation or existed in VUS section. The result is stored in mutationMessages, and updated in real time as editing.
             * The other one is about the detailed mutation content inside when first loaded the gene page, and the result is stored in mutationContent.
             * **/
            var sortedLevel = _.keys($rootScope.meta.levelsDesc).sort();
            $scope.getMutationMessages = function () {
                $scope.mutationContent = {};
                var tempNameList = [];
                for (var i = 0; i < $scope.mutations.length; i++) {
                    var mutation = $scope.mutations[i];
                    var uuid = mutation.name_uuid;
                    $scope.mutationContent[uuid] = {
                        TT: 0,
                        levels: []
                    };
                    if (mutation.tumors) {
                        for (var j = 0; j < mutation.tumors.length; j++) {
                            var tumor = mutation.tumors[j];
                            if (!(tumor.cancerTypes_review && tumor.cancerTypes_review.removed)) {
                                $scope.mutationContent[uuid].TT++;
                                for (var m = 0; m < tumor.TIs.length; m++) {
                                    var ti = tumor.TIs[m];
                                    if (ti.treatments) {
                                        for (var n = 0; n < ti.treatments.length; n++) {
                                            var treatment = ti.treatments[n];
                                            if (!(treatment.name_review && treatment.name_review.removed)) {
                                                $scope.mutationContent[uuid].levels.push(treatment.level);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if ($scope.mutationContent[uuid].TT > 0) {
                        $scope.mutationContent[uuid].levels.sort(function (a, b) {
                            return sortedLevel.indexOf(a) - sortedLevel.indexOf(b);
                        });
                        $scope.mutationContent[uuid].result = $scope.mutationContent[uuid].TT + 'x TT';
                        if ($scope.mutationContent[uuid].levels.length > 0) {
                            $scope.mutationContent[uuid].levels = _.map(_.uniq($scope.mutationContent[uuid].levels), function (level) {
                                return '<span style="color: ' + $rootScope.meta.colorsByLevel['Level_' + level] + '">' + level + '</span>';
                            });
                            $scope.mutationContent[uuid].result += ', Levels: ' + $scope.mutationContent[uuid].levels.join(', ') + '</span>';
                        }
                    }
                }
            };
            /**
             * This function is used to calculate 2 types of tumor messages we want to indicate in the tumor section header.
             * The first one is about the tumor name validation result such as duplicated tumor. The result is stored in tumorMessages, and updated in real time as editing.
             * The other one is about the detailed treatment info inside when first open the tumor section, and the result is stored in tumorContent.
             * **/
            $rootScope.getTumorMessages = function (mutation) {
                return true;
                var mutationName = mutation.name.toLowerCase();
                if (!$scope.tumorMessages) {
                    $scope.tumorMessages = {};
                }
                $scope.tumorMessages[mutationName] = {};
                $scope.tumorContent = {};
                var tempNameList = [];
                for (var j = 0; j < mutation.tumors.length; j++) {
                    var tumor = mutation.tumors.get(j);
                    var uuid = tumor.cancerTypes_uuid;
                    var tumorName = $scope.getCancerTypesName(tumor).toLowerCase();
                    if (tempNameList.indexOf(tumorName) === -1) {
                        tempNameList.push(tumorName);
                        $scope.tumorMessages[mutationName][tumorName] = '';
                    } else {
                        $scope.tumorMessages[mutationName][tumorName] = 'Tumor exists';
                    }
                    for (var m = 0; m < tumor.TIs.length; m++) {
                        var ti = tumor.TIs.get(m);
                        for (var n = 0; n < ti.treatments.length; n++) {
                            var treatment = ti.treatments.get(n);
                            if (!treatment.name_review.get('removed')) {
                                if (!$scope.tumorContent[uuid]) {
                                    $scope.tumorContent[uuid] = {};
                                }
                                var tempLevel = treatment.level;
                                if ($scope.tumorContent[uuid][tempLevel]) {
                                    $scope.tumorContent[uuid][tempLevel]++;
                                } else {
                                    $scope.tumorContent[uuid][tempLevel] = 1;
                                }
                            }
                        }
                    }
                    var levels = _.keys($scope.tumorContent[uuid]);
                    if (levels.length > 0) {
                        levels.sort(function (a, b) {
                            return sortedLevel.indexOf(a) - sortedLevel.indexOf(b);
                        });
                        var result = [];
                        _.each(levels, function (level) {
                            result.push('<span>' + $scope.tumorContent[uuid][level] + 'x </span><span style="color: ' + $rootScope.meta.colorsByLevel['Level_' + level] + '">Level ' + level + '</span>');
                        });
                        $scope.tumorContent[uuid].result = result.join('; ');
                    }
                }
            }
            // Keep working on this function
            $scope.getTumorContent = function (mutation) {
                $scope.tumorContent = {};
                if (!mutation.tumors) {
                    return;
                }
                for (var j = 0; j < mutation.tumors.length; j++) {
                    var tumor = mutation.tumors[j];
                    var uuid = tumor.cancerTypes_uuid;
                    for (var m = 0; m < tumor.TIs.length; m++) {
                        var ti = tumor.TIs[m];
                        if (!ti.treatments) {
                            continue;
                        }
                        for (var n = 0; n < ti.treatments.length; n++) {
                            var treatment = ti.treatments[n];
                            if (!(treatment.name_review && treatment.name_review.removed)) {
                                if (!$scope.tumorContent[uuid]) {
                                    $scope.tumorContent[uuid] = {};
                                }
                                var tempLevel = treatment.level;
                                if ($scope.tumorContent[uuid][tempLevel]) {
                                    $scope.tumorContent[uuid][tempLevel]++;
                                } else {
                                    $scope.tumorContent[uuid][tempLevel] = 1;
                                }
                            }
                        }
                    }
                    var levels = _.keys($scope.tumorContent[uuid]);
                    if (levels.length > 0) {
                        levels.sort(function (a, b) {
                            return sortedLevel.indexOf(a) - sortedLevel.indexOf(b);
                        });
                        var result = [];
                        _.each(levels, function (level) {
                            result.push('<span>' + $scope.tumorContent[uuid][level] + 'x </span><span style="color: ' + $rootScope.meta.colorsByLevel['Level_' + level] + '">Level ' + level + '</span>');
                        });
                        $scope.tumorContent[uuid].result = result.join('; ');
                    }
                }
            }
            $scope.getTreatmentMessages = function (mutation, tumor, ti) {
                return true;
                var mutationName = mutation.name.toLowerCase();
                var tumorName = $scope.getCancerTypesName(tumor).toLowerCase();
                var tiName = ti.name.toLowerCase();
                var tempNameList = [];
                if (!$scope.treatmentMessages) {
                    $scope.treatmentMessages = {};
                }
                if (!$scope.treatmentMessages[mutationName]) {
                    $scope.treatmentMessages[mutationName] = {};
                }
                if (!$scope.treatmentMessages[mutationName][tumorName]) {
                    $scope.treatmentMessages[mutationName][tumorName] = {};
                }
                $scope.treatmentMessages[mutationName][tumorName][tiName] = {};
                for (var n = 0; n < ti.treatments.length; n++) {
                    var treatmentName = ti.treatments.get(n).name.toLowerCase();
                    if (tempNameList.indexOf(treatmentName) === -1) {
                        tempNameList.push(treatmentName);
                    } else {
                        $scope.treatmentMessages[mutationName][tumorName][tiName][treatmentName] = 'Therapy exists';
                    }
                }
            }

            $scope.stateComparator = function (state, viewValue) {
                return viewValue === SecretEmptyKey || (String(state)).toLowerCase().indexOf((String(viewValue)).toLowerCase()) > -1;
            };

            $scope.getComments = function () {
                console.log($scope.comments);
            };
            $scope.vusUpdate = function () {
                if ($scope.status.isDesiredGene) {
                    if ($scope.status.vusUpdateTimeout) {
                        $timeout.cancel($scope.status.vusUpdateTimeout);
                    }
                    $scope.status.vusUpdateTimeout = $timeout(function () {
                        // DatabaseConnector.updateVUS($scope.fileTitle, JSON.stringify($scope.vusFire), function(result) {
                        //     console.log('success saving vus to database');
                        // }, function(error) {
                        //     console.log('error happened when saving VUS to DB', error);
                        // });
                    }, 2000);
                }
                // update the meta track
                // mainUtils.updateLastModified();
            };

            $scope.getData = function (data) {
                console.log(JSON.stringify($scope.gene));
            };

            function parseMutationString(mutationStr) {
                mutationStr = mutationStr.replace(/\([^\)]+\)/g, '');
                var parts = _.map(mutationStr.split(','), function (item) {
                    return item.trim();
                });
                var altResults = [];
                var proteinChange = '';
                var displayName = '';

                for (var i = 0; i < parts.length; i++) {
                    if (!parts[i]) continue;
                    if (parts[i].indexOf('[') === -1) {
                        proteinChange = parts[i];
                        displayName = parts[i];
                    } else {
                        var l = parts[i].indexOf('[');
                        var r = parts[i].indexOf(']');
                        proteinChange = parts[i].substring(0, l);
                        displayName = parts[i].substring(l + 1, r);
                    }

                    if (proteinChange.indexOf('/') === -1) {
                        altResults.push({
                            alteration: proteinChange,
                            name: displayName,
                            gene: {
                                hugoSymbol: $scope.gene.name
                            }
                        });
                    } else {
                        var tempRes = proteinChange.match(/([A-Z][0-9]+)(.*)/i);
                        var refs = tempRes[2].split('/');
                        for (var j = 0; j < refs.length; j++) {
                            altResults.push({
                                alteration: tempRes[1] + refs[j],
                                name: displayName,
                                gene: {
                                    hugoSymbol: $scope.gene.name
                                }
                            });
                        }
                    }
                }
                return altResults;
            }

            $rootScope.reviewMode = false;
            $rootScope.rejectedUUIDs = {};
            /**
             * Check if a section needs to be displayed or not.
             * For instance, would be used to check if Mutation Effect section needs to be displayed.
             * If it is a section with only one item, we still treat it as section by using displayCheck(), e.g. Prevelance, Clinical Trials
             * However, if it is just a single item without section frame work, we use displayPrecisely(), e.g. Tumor Summary, TI Description
             * ***/
            $scope.displayCheck = function (uuid, reviewObj) {
                // regular mode check
                if (!$rootScope.reviewMode) {
                    if (reviewObj && reviewObj.removed === true) {
                        return false;
                    }
                    return true;
                }
                // review mode check
                return uuid && ($scope.sectionUUIDs.indexOf(uuid) !== -1 || mainUtils.processedInReview('inside', uuid));
            };
            /**
             * Check if each item inside a section needs to be displayed or not
             * For instance, there are three items Oncogenic, Effect and Description inside Mutation Effect section.
             * And this function will be used to check each item needs to be displayed or not.
             * ***/
            $scope.displayPrecisely = function (uuid) {
                if (!$rootScope.reviewMode) return true;
                else {
                    // review mode logic checks
                    if (mainUtils.processedInReview('inside', uuid)) {
                        return true;
                    } else if ($rootScope.geneMeta.review && $rootScope.geneMeta.review[uuid]) {
                        if (!mainUtils.processedInReview('precise', uuid)) {
                            ReviewResource.precise.push(uuid);
                        }
                        return true;
                    } else return mainUtils.processedInReview('precise', uuid);
                }
            };
            $scope.review = function () {
                if ($rootScope.reviewMode) {
                    $scope.exitReview();
                } else {
                    var collaborators = $rootScope.collaborators;
                    var otherCollaborators = [];
                    _.each(collaborators, function (collaborator) {
                        if (collaborator.name !== $rootScope.me.name) {
                            otherCollaborators.push(collaborator.name);
                        }
                    });
                    if (otherCollaborators.length > 0) {
                        var dlg = dialogs.confirm('Reminder', otherCollaborators.join(', ') + ((otherCollaborators.length > 1) ? ' are' : ' is') + ' currently working on this gene document. Entering review mode will disable them from editing.');
                        dlg.result.then(function () {
                            prepareReviewItems();
                        });
                    } else {
                        prepareReviewItems();
                    }
                }
            };
            $scope.exitReview = function () {
                $rootScope.geneMeta.currentReviewer = '';
                $rootScope.reviewMode = false;
                ReviewResource.reviewMode = false;
                $scope.fileEditable = true;
                evidencesAllUsers = {};
                $interval.cancel($scope.reviewMoeInterval);
                // close all mutations
                ReviewResource.accepted = [];
                ReviewResource.rejected = [];
                ReviewResource.rollback = [];
                ReviewResource.loading = [];
                ReviewResource.inside = [];
                ReviewResource.updated = [];
                ReviewResource.nameChanged = [];
                ReviewResource.added = [];
                ReviewResource.removed = [];
                ReviewResource.mostRecent = {};
                ReviewResource.precise = [];
                $scope.setSectionOpenStatus('close', $scope.sectionUUIDs);
            };
            $scope.developerCheck = function () {
                return mainUtils.developerCheck($rootScope.me.name);
            };
            $scope.geneMainDivStyle = {
                opacity: '1'
            };
            function setReview(uuid, flag) {
                uuid = uuid;
                if (flag) {
                    if ($rootScope.geneMetaData.get(uuid)) {
                        $rootScope.geneMetaData.get(uuid).set('review', true);
                    } else {
                        var temp = $rootScope.metaModel.createMap();
                        temp.set('review', true);
                        $rootScope.geneMetaData.set(uuid, temp);
                    }
                } else if (!flag) {
                    if ($rootScope.geneMetaData.get(uuid)) {
                        $rootScope.geneMetaData.get(uuid).set('review', false);
                    }
                }
            }
            /**
             * This function is used to find the most recent update from a section change. e.g. There are 4 items under NCCN section, and they might get changed at very different time.
             * And we will find the one changed most recently and store them in ReviewResource.mostRecent mapping, so it could be shared across directives and controllers
             * */
            function setUpdatedSignatureFire(tempArr, uuid) {
                if (uuid) {
                    var uuidString = uuid;
                    var mostRecent = stringUtils.mostRecentItemFire(tempArr);
                    ReviewResource.mostRecent[uuidString] = {
                        updatedBy: tempArr[mostRecent].updatedBy,
                        updateTime: tempArr[mostRecent].updateTime
                    };
                    userNames.push(tempArr[mostRecent].updatedBy);
                }
            }

            function setUpdatedSignature(tempArr, uuid) {
                if (uuid) {
                    var uuidString = uuid;
                    var mostRecent = stringUtils.mostRecentItem(tempArr);
                    ReviewResource.mostRecent[uuidString] = {
                        updatedBy: tempArr[mostRecent].updatedBy,
                        updateTime: tempArr[mostRecent].updateTime
                    };
                    userNames.push(tempArr[mostRecent].updatedBy);
                }
            }

            var evidencesAllUsers = {};

            function formEvidencesPerUser(userName, type, mutation, tumor, TI, treatment) {
                var getEvidenceResult = $scope.getEvidence(type, mutation, tumor, TI, treatment);
                var evidences = getEvidenceResult.evidences;
                var historyData = getEvidenceResult.historyData;
                if (!_.isEmpty(evidences)) {
                    evidencesAllUsers[userName].updatedEvidences = _.extend(evidencesAllUsers[userName].updatedEvidences, evidences);
                    evidencesAllUsers[userName].historyData.update.push(historyData);
                    evidencesAllUsers[userName].updatedEvidenceModels.push([type, mutation, tumor, TI, treatment]);
                }
            }
            $scope.getButtonContent = function (x) {
                if (x) {
                    return $scope.status[x].savingAll ? 'Saving ' + '<i class="fa fa-spinner fa-spin"></i>' : 'Accept All Changes from <b>' + x + '</b>';
                }
                return '';
            };
            function isChangedSection(uuids) {
                var result = false;
                _.some(uuids, function (uuid) {
                    if ($rootScope.geneMeta.review[uuid]) {
                        result = true;
                        return true;
                    }
                });
                return result;
            }
            var userNames = [];
            function prepareReviewItems() {
                if (_.isUndefined($rootScope.geneMeta.review)) {
                    dialogs.notify('Warning', 'No changes need to be reviewed');
                    return true;
                }
                $scope.sectionUUIDs = []; // sectionUUIDs is used to store uuid per section.
                $scope.status.noChanges = false;
                $scope.status.hasReviewContent = false;
                $scope.status.mutationChanged = false;
                userNames = [];
                var geneEviKeys = ['summary', 'type', 'background'];
                _.each(geneEviKeys, function (item) {
                    var changeHappened = false;
                    var userName = '';
                    if (item === 'type') {
                        // var metaObjOCG = $rootScope.metaFire[$scope.geneFire.type.ocg_uuid];
                        // var metaObjTSG = $rootScope.metaFire[$scope.geneFire.type.tsg_uuid];
                        // if (metaObjOCG && metaObjOCG.review === true) {
                        //     userName = $scope.geneFire.type.ocg_review.updatedBy;
                        //     changeHappened = true;
                        // } else if (metaObjTSG && metaObjTSG.review === true) {
                        //     userName = $scope.geneFire.type.tsg_review.updatedBy;
                        //     changeHappened = true;
                        // }
                        // setUpdatedSignatureFire([$scope.geneFire.type.ocg_review, $scope.geneFire.type.tsg_review], $scope.geneFire.type_uuid);
                    } else {
                        if ($rootScope.geneMeta.review[$scope.gene[item + '_uuid']]) {
                            userName = $scope.gene[item + '_review'].updatedBy;
                            changeHappened = true;
                        }
                    }
                    if (changeHappened === true) {
                        $scope.status.hasReviewContent = true;
                        userNames.push(userName);
                        $scope.sectionUUIDs.push($scope.gene[item + '_uuid']);
                        ReviewResource.updated.push($scope.gene[item + '_uuid']);
                    }
                });
                var mutationChanged = false;
                var tumorChanged = false;
                var tiChanged = false;
                var treatmentChanged = false;
                var mutationSectionChanged = false;
                var tumorSectionChanged = false;
                var treatmentSectionChanged = false;
                var tempArr = [];
                _.each($scope.mutations, function (mutation) {
                    mutationSectionChanged = false;
                    if (mutation.name_review) {
                        if (mutation.name_review.added) {
                            ReviewResource.added.push(mutation.name_uuid);
                            mutationSectionChanged = true;
                        }
                        if (mutation.name_review.removed) {
                            ReviewResource.removed.push(mutation.name_uuid);
                            mutationSectionChanged = true;
                        }
                    }
                    if (mutationSectionChanged) {
                        $scope.status.hasReviewContent = true;
                        userNames.push(mutation.name_review.updatedBy);
                        tempArr = collectUUIDs('mutation', mutation, [], false, false, true);
                        $scope.sectionUUIDs = _.union($scope.sectionUUIDs, tempArr);
                        tempArr = collectUUIDs('mutation', mutation, [], true, false, false);
                        ReviewResource.inside = _.union(ReviewResource.inside, tempArr);
                        $scope.status.mutationChanged = true;
                        return true;
                    }
                    if (isChangedSection([mutation.mutation_effect.oncogenic_uuid, mutation.mutation_effect.effect_uuid, mutation.mutation_effect.description_uuid])) {
                        tempArr = [mutation.mutation_effect.oncogenic_review, mutation.mutation_effect.effect_review, mutation.mutation_effect.description_review];
                        $scope.sectionUUIDs.push(mutation.mutation_effect_uuid);
                        ReviewResource.updated.push(mutation.mutation_effect_uuid);
                        mutationChanged = true;
                        setUpdatedSignature(tempArr, mutation.mutation_effect_uuid);
                    }
                    _.each(mutation.tumors, function (tumor) {
                        tumorSectionChanged = false;
                        if (tumor.cancerTypes_review) {
                            if (tumor.cancerTypes_review.added) {
                                ReviewResource.added.push(tumor.cancerTypes_uuid);
                                tumorSectionChanged = true;
                            }
                            if (tumor.cancerTypes_review.removed) {
                                ReviewResource.removed.push(tumor.cancerTypes_uuid);
                                tumorSectionChanged = true;
                            }
                        }
                        if (tumorSectionChanged) {
                            mutationChanged = true;
                            userNames.push(tumor.cancerTypes_review.updatedBy);
                            tempArr = collectUUIDs('tumor', tumor, [], false, false, true);
                            $scope.sectionUUIDs = _.union($scope.sectionUUIDs, tempArr);
                            tempArr = collectUUIDs('tumor', tumor, [], true, false, false);
                            ReviewResource.inside = _.union(ReviewResource.inside, tempArr);
                            return true;
                        }
                        if (isChangedSection([tumor.prognostic.level_uuid, tumor.prognostic.description_uuid])) {
                            tempArr = [tumor.prognostic.description_review, tumor.prognostic.level_review];
                            $scope.sectionUUIDs.push(tumor.prognostic_uuid);
                            ReviewResource.updated.push(tumor.prognostic_uuid);
                            tumorChanged = true;
                            setUpdatedSignature(tempArr, tumor.prognostic_uuid);
                        }
                        if (isChangedSection([tumor.diagnostic.level_uuid, tumor.diagnostic.description_uuid])) {
                            tempArr = [tumor.diagnostic.description_review, tumor.diagnostic.level_review];
                            $scope.sectionUUIDs.push(tumor.diagnostic_uuid);
                            ReviewResource.updated.push(tumor.diagnostic_uuid);
                            tumorChanged = true;
                            setUpdatedSignature(tempArr, tumor.diagnostic_uuid);
                        }
                        if (isChangedSection([tumor.summary_uuid])) {
                            tumorChanged = true;
                            userNames.push(tumor.summary_review.updatedBy);
                            ReviewResource.updated.push(tumor.summary_uuid);
                        }
                        _.each(tumor.TIs, function (ti) {
                            _.each(ti.treatments, function (treatment) {
                                treatmentSectionChanged = false;
                                if (treatment.name_review) {
                                    if (treatment.name_review.added) {
                                        tiChanged = true;
                                        userNames.push(treatment.name_review.updatedBy);
                                        ReviewResource.added.push(treatment.name_uuid);
                                        treatmentSectionChanged = true;
                                    }
                                    if (treatment.name_review.removed) {
                                        tiChanged = true;
                                        userNames.push(treatment.name_review.updatedBy);
                                        ReviewResource.removed.push(treatment.name_uuid);
                                        treatmentSectionChanged = true;
                                    }
                                }
                                if (treatmentSectionChanged) {
                                    tempArr = collectUUIDs('treatment', treatment, [], false, false, true);
                                    $scope.sectionUUIDs = _.union($scope.sectionUUIDs, tempArr);
                                    tempArr = collectUUIDs('treatment', treatment, [], true, false, false);
                                    ReviewResource.inside = _.union(ReviewResource.inside, tempArr);
                                    return true;
                                }
                                if (isChangedSection([treatment.level_uuid, treatment.propagation_uuid, treatment.indication_uuid, treatment.description_uuid])) {
                                    tempArr = [treatment.name_review, treatment.level_review, treatment.propagation_review, treatment.indication_review, treatment.description_review];
                                    treatmentChanged = true;
                                    setUpdatedSignature([treatment.level_review, treatment.propagation_review, treatment.indication_review, treatment.description_review], treatment.name_uuid);
                                    ReviewResource.updated.push(treatment.name_uuid);
                                } else if (isChangedSection([treatment.name_uuid])) {
                                    treatmentChanged = true;
                                    userNames.push(treatment.name_review.updatedBy);
                                    ReviewResource.nameChanged.push(treatment.name_uuid);
                                }
                                if (treatmentChanged) {
                                    $scope.sectionUUIDs.push(treatment.name_uuid);
                                    tiChanged = true;
                                }
                                treatmentChanged = false;
                            });
                            if (isChangedSection([ti.description_uuid])) {
                                ReviewResource.updated.push(ti.description_uuid);
                                userNames.push(ti.description_review.updatedBy);
                                tiChanged = true;
                            }
                            if (tiChanged) {
                                $scope.sectionUUIDs.push(ti.name_uuid);
                                tumorChanged = true;
                            }
                            tiChanged = false;
                        });
                        if (isChangedSection([tumor.cancerTypes_uuid])) {
                            tumorChanged = true;
                            userNames.push(tumor.cancerTypes_review.updatedBy);
                            ReviewResource.nameChanged.push(tumor.cancerTypes_uuid);
                        }
                        if (tumorChanged) {
                            $scope.sectionUUIDs.push(tumor.cancerTypes_uuid);
                            mutationChanged = true;
                        }
                        tumorChanged = false;
                    });
                    if (isChangedSection[mutation.name_uuid]) {
                        mutationChanged = true;
                        userNames.push(mutation.name_review.updatedBy);
                        ReviewResource.nameChanged.push(mutation.name_uuid);
                    }
                    if (mutationChanged) {
                        $scope.sectionUUIDs.push(mutation.name_uuid);
                        $scope.status.hasReviewContent = true;
                        $scope.status.mutationChanged = true;
                    }
                    mutationChanged = false;
                });
                if ($scope.status.hasReviewContent === false) {
                    $rootScope.geneMeta.currentReviewer = '';
                    delete $rootScope.geneMeta.review;
                    dialogs.notify('Warning', 'No changes need to be reviewed');
                } else {
                    $rootScope.geneMeta.currentReviewer = $rootScope.me.name;
                    $rootScope.reviewMode = true;
                    ReviewResource.reviewMode = true;
                    if ($scope.status.mutationChanged) {
                        $scope.setSectionOpenStatus('open', $scope.sectionUUIDs);
                    }
                    var validUsers = [];
                    _.each(_.uniq(userNames), function (userName) {
                        if (userName) {
                            $scope.status[userName] = {};
                            validUsers.push(userName);
                        }
                    });
                    $scope.namesWithChanges = validUsers;
                }
            }
            function doneSaving(userName) {
                $scope.status[userName].savingAll = false;
                $scope.status[userName].noChanges = true;
                evidencesAllUsers[userName] = {};
            };
            $scope.acceptChangesByPerson = function (userName) {
                if (!userName) {
                    dialogs.error('Error', 'Can not accept changes from invalid user name. Please contact the developer.');
                    return false;
                }
                if ($scope.status.isDesiredGene) {
                    $scope.status[userName].savingAll = true;
                }
                collectChangesByPerson(userName);
                var apiCalls = [];
                if (!_.isEmpty(evidencesAllUsers[userName].geneTypeEvidence)) {
                    apiCalls.push(geneTypeUpdate(userName));
                }
                if (!_.isEmpty(evidencesAllUsers[userName].updatedEvidences)) {
                    apiCalls.push(evidenceBatchUpdate(userName));
                }
                if (!_.isEmpty(evidencesAllUsers[userName].deletedEvidences)) {
                    apiCalls.push(evidenceDeleteUpdate(userName));
                }
                if (apiCalls.length === 0) {
                    doneSaving(userName);
                } else {
                    $q.all(apiCalls)
                        .then(function (result) {
                            doneSaving(userName);
                        }, function (error) {
                            doneSaving(userName);
                            dialogs.error('Error', 'Failed to update to database! Please contact the developer.');
                        });
                }
            };
            function processAddedSection(userName, type, mutation, tumor, ti, treatment) {
                var tempEvidences = formSectionEvidencesByType(type, mutation, tumor, ti, treatment);
                var evidences = tempEvidences.evidences;
                var historyData = tempEvidences.historyData;
                if (!_.isEmpty(evidences)) {
                    evidencesAllUsers[userName].updatedEvidences = _.extend(evidencesAllUsers[userName].updatedEvidences, evidences);
                    evidencesAllUsers[userName].historyData.update.push(historyData);
                    evidencesAllUsers[userName].updatedEvidenceModels.push([type, mutation, tumor, ti, treatment]);
                } else {
                    // for empty section
                    acceptSection(type, mutation, tumor, ti, treatment);
                }
            }
            /*****
             * This function is designed to check if a section has been changed or not, and if it is changed by a certain person
             *  ****/
            function isChangedBy(type, uuid, userName, reviewObj) {
                if (uuid) {
                    if (type === 'section') {
                        uuid = uuid;
                        return uuid && $scope.sectionUUIDs.indexOf(uuid) !== -1 && ReviewResource.mostRecent[uuid] && ReviewResource.mostRecent[uuid].updatedBy === userName;
                    } else if (type === 'precise') {
                        return mainUtils.processedInReview('precise', uuid) && reviewObj && reviewObj.updatedBy === userName;
                    }
                } else {
                    return false;
                }
            }
            function collectChangesByPerson(userName) {
                // This function can only be called in the review mode, in which, mostRecent has already been set in the prepareReview function
                evidencesAllUsers[userName] = {
                    updatedEvidences: {},
                    historyData: {
                        geneType: [],
                        update: [],
                        deletion: []
                    },
                    deletedEvidences: [],
                    geneTypeEvidence: {},
                    updatedEvidenceModels: [],
                    deletedEvidenceModels: []
                };
                if (isChangedBy('precise', $scope.gene.summary_uuid, userName, $scope.gene.summary_review)) {
                    formEvidencesPerUser(userName, 'GENE_SUMMARY', null, null, null, null);
                }
                if (isChangedBy('precise', $scope.gene.background_uuid, userName, $scope.gene.background_review)) {
                    formEvidencesPerUser(userName, 'GENE_BACKGROUND', null, null, null, null);
                }
                if (isChangedBy('precise', $scope.gene.type_uuid, userName, $scope.gene.type_review)) {
                    evidencesAllUsers[userName].geneTypeEvidence = {
                        hugoSymbol: $scope.gene.name,
                        oncogene: $scope.gene.type.get('OCG') ? true : false,
                        tsg: $scope.gene.type.get('TSG') ? true : false
                    };
                    evidencesAllUsers[userName].historyData.geneType = [{
                        lastEditBy: $scope.gene.type_review.updatedBy,
                        operation: 'update',
                        uuids: $scope.gene.type_uuid,
                        location: 'Gene Type'
                    }];
                }
                _.each($scope.mutations, function (mutation) {
                    // collect changes that happened in mutation level
                    if (mutation.name_review.updatedBy === userName) {
                        if (mainUtils.processedInReview('remove', mutation.name_uuid)) {
                            evidencesAllUsers[userName].deletedEvidences = collectUUIDs('mutation', mutation, evidencesAllUsers[userName].deletedEvidences);
                            evidencesAllUsers[userName].deletedEvidenceModels.push(['mutation', mutation]);
                            evidencesAllUsers[userName].historyData.deletion.push({ operation: 'delete', lastEditBy: mutation.name_review.updatedBy, location: mutation.name });
                            return true;
                        } else if (mainUtils.processedInReview('add', mutation.name_uuid)) {
                            processAddedSection(userName, 'mutation', mutation);
                            return true;
                        } else if (mainUtils.processedInReview('name', mutation.name_uuid)) {
                            formEvidencesPerUser(userName, 'MUTATION_NAME_CHANGE', mutation, null, null, null);
                        }

                    }
                    // collect changes happened inside mutation, similar logics are applied to tumor and treatment
                    if (isChangedBy('section', mutation.mutation_effect_uuid, userName)) {
                        formEvidencesPerUser(userName, 'MUTATION_EFFECT', mutation, null, null, null);
                    }
                    _.each(mutation.tumors, function (tumor) {
                        if (tumor.cancerTypes_review.updatedBy === userName) {
                            if (mainUtils.processedInReview('remove', tumor.cancerTypes_uuid)) {
                                evidencesAllUsers[userName].deletedEvidences = collectUUIDs('tumor', tumor, evidencesAllUsers[userName].deletedEvidences);
                                evidencesAllUsers[userName].deletedEvidenceModels.push(['tumor', mutation, tumor]);
                                evidencesAllUsers[userName].historyData.deletion.push({ operation: 'delete', lastEditBy: tumor.cancerTypes_review.updatedBy, location: historyStr(mutation, tumor) });
                                return true;
                            } else if (mainUtils.processedInReview('add', tumor.cancerTypes_uuid)) {
                                processAddedSection(userName, 'tumor', mutation, tumor);
                                return true;
                            }
                        }
                        if (tumor.cancerTypes_review.updatedBy === userName && mainUtils.processedInReview('name', tumor.cancerTypes_uuid)) {
                            formEvidencesPerUser(userName, 'TUMOR_NAME_CHANGE', mutation, tumor, null, null);
                        }
                        if (isChangedBy('section', tumor.prognostic_uuid, userName)) {
                            formEvidencesPerUser(userName, 'PROGNOSTIC_IMPLICATION', mutation, tumor, null, null);
                        }
                        if (isChangedBy('section', tumor.diagnostic_uuid, userName)) {
                            formEvidencesPerUser(userName, 'DIAGNOSTIC_IMPLICATION', mutation, tumor, null, null);
                        }
                        _.each(tumor.TIs, function (ti) {
                            _.each(ti.treatments, function (treatment) {
                                if (treatment.name_review.updatedBy === userName) {
                                    if (mainUtils.processedInReview('remove', treatment.name_uuid)) {
                                        evidencesAllUsers[userName].deletedEvidences = collectUUIDs('treatment', treatment, evidencesAllUsers[userName].deletedEvidences);
                                        evidencesAllUsers[userName].deletedEvidenceModels.push(['treatment', mutation, tumor, ti, treatment]);
                                        evidencesAllUsers[userName].historyData.deletion.push({ operation: 'delete', lastEditBy: treatment.name_review.updatedBy, location: historyStr(mutation, tumor) + ', ' + ti.name + ', ' + treatment.name });
                                        return true;
                                    } else if (mainUtils.processedInReview('add', treatment.name_uuid)) {
                                        processAddedSection(userName, 'treatment', mutation, tumor, ti, treatment);
                                        return true;
                                    } else if (mainUtils.processedInReview('name', treatment.name_uuid)) {
                                        formEvidencesPerUser(userName, 'TREATMENT_NAME_CHANGE', mutation, tumor, ti, treatment);
                                    }
                                }
                                if (isChangedBy('section', treatment.name_uuid, userName)) {
                                    formEvidencesPerUser(userName, ti.name, mutation, tumor, ti, treatment);
                                }
                            });
                            if (isChangedBy('precise', ti.description_uuid, userName, ti.description_review)) {
                                formEvidencesPerUser(userName, ti.name, mutation, tumor, ti, null);
                            }
                        });
                        if (isChangedBy('precise', tumor.summary_uuid, userName, tumor.summary_review)) {
                            formEvidencesPerUser(userName, 'TUMOR_TYPE_SUMMARY', mutation, tumor, null, null);
                        }
                    });
                });
            }
            function geneTypeUpdate(userName) {
                var deferred = $q.defer();
                if ($scope.status.isDesiredGene) {
                    var geneTypeEvidence = evidencesAllUsers[userName].geneTypeEvidence;
                    var historyData = evidencesAllUsers[userName].historyData.geneType;
                    DatabaseConnector.updateGeneType($scope.gene.name, geneTypeEvidence, historyData, function (result) {
                        $scope.modelUpdate('GENE_TYPE', null, null, null, null);
                        deferred.resolve();
                    }, function (error) {
                        deferred.reject(error);
                    });
                } else {
                    $scope.modelUpdate('GENE_TYPE', null, null, null, null);
                    deferred.resolve();
                }
                return deferred.promise;
            }

            function evidenceBatchUpdate(userName) {
                var deferred = $q.defer();
                var updatedEvidenceModels = evidencesAllUsers[userName].updatedEvidenceModels;
                if ($scope.status.isDesiredGene) {
                    var updatedEvidences = evidencesAllUsers[userName].updatedEvidences;
                    var historyData = evidencesAllUsers[userName].historyData.update;
                    if ($rootScope.geneMeta.review) {
                        _.each(_.keys(updatedEvidences), function (uuid) {
                            delete $rootScope.geneMeta.review[uuid];    
                        });
                    }
                    DatabaseConnector.updateEvidenceBatch(updatedEvidences, historyData, function (result) {
                        for (var i = 0; i < updatedEvidenceModels.length; i++) {
                            $scope.modelUpdate(updatedEvidenceModels[i][0], updatedEvidenceModels[i][1], updatedEvidenceModels[i][2], updatedEvidenceModels[i][3], updatedEvidenceModels[i][4]);
                        }
                        deferred.resolve();
                    }, function (error) {
                        deferred.reject(error);
                    });
                } else {
                    for (var i = 0; i < updatedEvidenceModels.length; i++) {
                        $scope.modelUpdate(updatedEvidenceModels[i][0], updatedEvidenceModels[i][1], updatedEvidenceModels[i][2], updatedEvidenceModels[i][3], updatedEvidenceModels[i][4]);
                    }
                    deferred.resolve();
                }
                return deferred.promise;
            }
            function evidenceDeleteUpdate(userName) {
                var deferred = $q.defer();
                var deletedEvidenceModels = evidencesAllUsers[userName].deletedEvidenceModels;
                if ($scope.status.isDesiredGene) {
                    var deletedEvidences = evidencesAllUsers[userName].deletedEvidences;
                    var historyData = evidencesAllUsers[userName].historyData.deletion;
                    DatabaseConnector.deleteEvidences(deletedEvidences, historyData, function (result) {
                        _.each(deletedEvidenceModels, function (item) {
                            removeModel(item[0], item[1], item[2], item[3], item[4], deletedEvidences);
                        });
                        deferred.resolve();
                    }, function (error) {
                        deferred.reject(error);
                    });
                } else {
                    _.each(deletedEvidenceModels, function (item) {
                        removeModel(item[0], item[1], item[2], item[3], item[4], deletedEvidences);
                    });
                    deferred.resolve();
                }
                return deferred.promise;
            }
            function historyStr(mutation, tumor) {
                if (mutation && tumor) {
                    return mutation.name + ', ' + $scope.getCancerTypesName(tumor);
                }
            }
            $scope.getEvidence = function (type, mutation, tumor, TI, treatment) {
                // The reason we are cheking again if a change has been made to a section is that, there might be many empty content in a newly added section.
                // We need to identify the evidences having input
                var historyData = { operation: 'update' };
                var historyUUIDs = [];
                var tempReviewObjArr;
                var tempRecentIndex;
                var evidences = {};
                var dataUUID = '';
                var extraDataUUID = '';
                var reviewObj;
                var data = {
                    additionalInfo: null,
                    alterations: null,
                    cancerType: null,
                    description: null,
                    evidenceType: type,
                    gene: {
                        hugoSymbol: $scope.gene.name
                    },
                    knownEffect: null,
                    lastEdit: null,
                    levelOfEvidence: null,
                    subtype: null,
                    articles: [],
                    treatments: null,
                    propagation: null
                };
                if ($scope.meta.gene) {
                    data.gene.entrezGeneId = $scope.meta.gene.entrezGeneId;
                }
                var levelMapping = {
                    '0': 'LEVEL_0',
                    '1': 'LEVEL_1',
                    '2A': 'LEVEL_2A',
                    '2B': 'LEVEL_2B',
                    '3A': 'LEVEL_3A',
                    '3B': 'LEVEL_3B',
                    '4': 'LEVEL_4',
                    'R1': 'LEVEL_R1',
                    'R2': 'LEVEL_R2',
                    'R3': 'LEVEL_R3',
                    'no': 'NO',
                    'P1': 'LEVEL_P1',
                    'P2': 'LEVEL_P2',
                    'P3': 'LEVEL_P3',
                    'P4': 'LEVEL_P4',
                    'D1': 'LEVEL_D1',
                    'D2': 'LEVEL_D2',
                    'D3': 'LEVEL_D3'
                };
                var extraData = _.clone(data);
                var i = 0;
                var uuids = [];
                switch (type) {
                    case 'GENE_SUMMARY':
                        data.description = $scope.gene.summary;
                        dataUUID = $scope.gene.summary_uuid;
                        data.lastEdit = $scope.gene.summary_review.updateTime;
                        historyData.location = 'Gene Summary';
                        reviewObj = $scope.gene.summary_review;
                        break;
                    case 'GENE_BACKGROUND':
                        data.description = $scope.gene.background;
                        dataUUID = $scope.gene.background_uuid;
                        data.lastEdit = $scope.gene.background_review.updateTime;
                        historyData.location = 'Gene Background';
                        reviewObj = $scope.gene.background_review;
                        break;
                    case 'MUTATION_EFFECT':
                        var MEObj = mutation.mutation_effect;
                        if ($rootScope.geneMeta.review[MEObj.oncogenic_uuid]) {
                            data.knownEffect = MEObj.oncogenic;
                            dataUUID = MEObj.oncogenic_uuid;
                            data.lastEdit = MEObj.oncogenic_review.updateTime;
                            historyData.location = mutation.name + ', Mutation Effect';
                            reviewObj = MEObj.oncogenic_review;
                        }
                        // tempFlag is set to true when MUTATION_EFFECT evidence exists which means either mutation effect or mutation description got changed.
                        var tempFlag = false;
                        if ($rootScope.geneMeta.review[MEObj.effect_uuid] || $rootScope.geneMeta.review[MEObj.description_uuid]) {
                            tempFlag = true;
                        }
                        if (tempFlag) {
                            tempReviewObjArr = [MEObj.effect_review, MEObj.description_review];
                            tempRecentIndex = stringUtils.mostRecentItem(tempReviewObjArr, true);
                            extraData.knownEffect = MEObj.effect;
                            extraDataUUID = MEObj.effect_uuid;
                            // We have to calculate the lastEdit time specifically here because ReviewResource.mostRecent[mutation.mutation_effect.oncogenic_uuid].updateTime is the most recent time among three items: oncogenic, mutation effect and description
                            // But here we only need the most recent time from mutation effect and description
                            extraData.lastEdit = tempReviewObjArr[tempRecentIndex].updateTime;
                            extraData.description = MEObj.description;
                            extraData.evidenceType = 'MUTATION_EFFECT';
                            historyData.location = mutation.name + ', Mutation Effect';
                            if (!reviewObj) {
                                if (MEObj.effect_review.updatedBy) {
                                    reviewObj = MEObj.effect_review;
                                } else if (MEObj.description_review.updatedBy) {
                                    reviewObj = MEObj.description_review;
                                }
                            }
                        }
                        break;
                    case 'TUMOR_TYPE_SUMMARY':
                        if ($rootScope.geneMeta.review[tumor.summary_uuid]) {
                            data.description = tumor.summary;
                            dataUUID = tumor.summary_uuid;
                            data.lastEdit = tumor.summary_review.updateTime;
                            historyData.location = historyStr(mutation, tumor) + ', Tumor Type Summary';
                            reviewObj = tumor.summary_review;
                        }
                        break;
                    case 'PROGNOSTIC_IMPLICATION':
                        if ($rootScope.geneMeta.review[tumor.prognostic.description_uuid] || $rootScope.geneMeta.review[tumor.prognostic.level_uuid]) {
                            data.description = tumor.prognostic.description;
                            data.levelOfEvidence = levelMapping[tumor.prognostic.level];
                            dataUUID = tumor.prognostic_uuid;
                            if (!ReviewResource.mostRecent[dataUUID]) {
                                setUpdatedSignature([tumor.prognostic.description_review, tumor.prognostic.level_review], tumor.prognostic_uuid);
                            }
                            data.lastEdit = ReviewResource.mostRecent[dataUUID].updateTime;
                            historyData.location = historyStr(mutation, tumor) + ', Prognostic';
                        }
                        break;
                    case 'DIAGNOSTIC_IMPLICATION':
                        if ($rootScope.geneMeta.review[tumor.diagnostic.description_uuid] || $rootScope.geneMeta.review[tumor.diagnostic.level_uuid]) {
                            data.description = tumor.diagnostic.description;
                            data.levelOfEvidence = levelMapping[tumor.diagnostic.level];
                            dataUUID = tumor.diagnostic_uuid;
                            if (!ReviewResource.mostRecent[dataUUID]) {
                                setUpdatedSignature([tumor.diagnostic.description_review, tumor.diagnostic.level_review], tumor.diagnostic_uuid);
                            }
                            data.lastEdit = ReviewResource.mostRecent[dataUUID].updateTime;
                            historyData.location = historyStr(mutation, tumor) + ', Diagnostic';
                        }
                        break;
                    case 'Standard implications for sensitivity to therapy':
                        data.evidenceType = 'STANDARD_THERAPEUTIC_IMPLICATIONS_FOR_DRUG_SENSITIVITY';
                        data.knownEffect = 'Sensitive';
                        break;
                    case 'Standard implications for resistance to therapy':
                        data.evidenceType = 'STANDARD_THERAPEUTIC_IMPLICATIONS_FOR_DRUG_RESISTANCE';
                        data.knownEffect = 'Resistant';
                        break;
                    case 'Investigational implications for sensitivity to therapy':
                        data.evidenceType = 'INVESTIGATIONAL_THERAPEUTIC_IMPLICATIONS_DRUG_SENSITIVITY';
                        data.knownEffect = 'Sensitive';
                        break;
                    case 'Investigational implications for resistance to therapy':
                        data.evidenceType = 'INVESTIGATIONAL_THERAPEUTIC_IMPLICATIONS_DRUG_RESISTANCE';
                        data.knownEffect = 'Resistant';
                        break;
                    case 'MUTATION_NAME_CHANGE':
                        uuids = collectUUIDs('mutation', mutation, [], true, true);
                        data.evidenceType = null;
                        historyData.location = mutation.name;
                        break;
                    case 'TUMOR_NAME_CHANGE':
                        uuids = collectUUIDs('tumor', tumor, [], true, true);
                        data.evidenceType = null;
                        historyData.location = historyStr(mutation, tumor);
                        break;
                    case 'TREATMENT_NAME_CHANGE':
                        uuids = collectUUIDs('treatment', treatment, [], true, true);
                        data.evidenceType = null;
                        historyData.location = historyStr(mutation, tumor) + ', ' + data.evidenceType + ', ' + treatment.name;
                        break;
                    default:
                        break;
                }
                if (tumor && type !== 'TREATMENT_NAME_CHANGE') {
                    var tempArr1 = [];
                    var tempArr2 = [];
                    if ($rootScope.geneMeta.review[tumor.cancerTypes_uuid] && _.isArray(tumor.cancerTypes_review.lastReviewed) && tumor.cancerTypes_review.lastReviewed.length > 0 && type !== 'TUMOR_NAME_CHANGE' && !tumor.cancerTypes_review.added) {
                        _.each(tumor.cancerTypes_review.lastReviewed, function (item) {
                            tempArr1.push(item.cancerType);
                            tempArr2.push(item.oncoTreeCode ? item.oncoTreeCode : 'null');
                        });
                    } else {
                        _.each(tumor.cancerTypes, function (item) {
                            tempArr1.push(item.cancerType);
                            tempArr2.push(item.oncoTreeCode ? item.oncoTreeCode : 'null');
                        });
                    }
                    if (tempArr1.length > 0) {
                        data.cancerType = tempArr1.join(';');
                        data.subtype = tempArr2.join(';');
                    }
                }
                if (TI) {
                    if (!treatment) {
                        if ($rootScope.geneMeta.review[TI.description_uuid]) {
                            data.description = TI.description;
                            dataUUID = TI.description_uuid;
                            data.lastEdit = TI.description_review.updateTime;
                            historyData.location = historyStr(mutation, tumor) + ', ' + data.evidenceType + ', Description';
                            reviewObj = TI.description_review;
                        }
                    } else {
                        dataUUID = treatment.name_uuid;
                        if (!ReviewResource.mostRecent[dataUUID]) {
                            setUpdatedSignature([treatment.name_review, treatment.level_review, treatment.indication_review, treatment.description_review], treatment.name_uuid);
                        }
                        data.lastEdit = ReviewResource.mostRecent[dataUUID].updateTime;
                        data.levelOfEvidence = levelMapping[treatment.level];
                        data.description = treatment.description;
                        data.propagation = levelMapping[treatment.propagation];
                        data.treatments = [];
                        var treatments = treatment.name.split(',');
                        var priorities = getNewPriorities(TI.treatments, [dataUUID]);
                        for (i = 0; i < treatments.length; i++) {
                            var drugs = treatments[i].split('+');
                            var drugList = [];
                            for (var j = 0; j < drugs.length; j++) {
                                drugList.push({
                                    drugName: drugs[j].trim(),
                                    priority: j + 1
                                });
                            }
                            data.treatments.push({
                                approvedIndications: [treatment.indication],
                                drugs: drugList,
                                priority: priorities[dataUUID][drugList.map(function (drug) {
                                    return drug.drugName;
                                }).join(' + ')]
                            });
                        }
                        historyData.location = historyStr(mutation, tumor) + ', ' + data.evidenceType + ', ' + treatment.name;
                    }
                }
                if (mutation && ['TUMOR_NAME_CHANGE', 'TREATMENT_NAME_CHANGE'].indexOf(type) === -1) {
                    var mutationStr;
                    if ($rootScope.geneMeta.review[mutation.name_uuid] && mutation.name_review.lastReviewed && type !== 'MUTATION_NAME_CHANGE' && !mutation.name_review.added) {
                        mutationStr = stringUtils.getTextString(mutation.name_review.lastReviewed);
                    } else {
                        mutationStr = mutation.name;
                    }
                    var mutationStrResult = parseMutationString(mutationStr);
                    if (dataUUID || type === 'MUTATION_NAME_CHANGE') {
                        data.alterations = mutationStrResult;
                    }
                    if (extraDataUUID) {
                        extraData.alterations = mutationStrResult;
                    }
                }
                if (data.description) {
                    formArticles(data);
                }
                if (extraData.description) {
                    formArticles(extraData);
                }
                if (data.lastEdit) {
                    data.lastEdit = validateTimeFormat(data.lastEdit);
                }
                if (extraData.lastEdit) {
                    extraData.lastEdit = validateTimeFormat(extraData.lastEdit);
                }
                if (dataUUID) {
                    evidences[dataUUID] = data;
                    historyUUIDs.push(dataUUID);
                }
                if (extraDataUUID) {
                    evidences[extraDataUUID] = extraData;
                    historyUUIDs.push(extraDataUUID);
                }
                if (historyUUIDs.length > 0) {
                    historyData.uuids = historyUUIDs.join(',');
                    if (dataUUID && ReviewResource.mostRecent[dataUUID]) {
                        historyData.lastEditBy = ReviewResource.mostRecent[dataUUID].updatedBy;
                    } else if (reviewObj) {
                        historyData.lastEditBy = reviewObj.updatedBy;
                    }
                }
                if (['MUTATION_NAME_CHANGE', 'TUMOR_NAME_CHANGE', 'TREATMENT_NAME_CHANGE'].indexOf(type) !== -1) {
                    _.each(uuids, function (uuid) {
                        evidences[uuid] = data;
                    });
                    historyData.operation = 'name change';
                    switch (type) {
                        case 'MUTATION_NAME_CHANGE':
                            historyData.uuids = mutation.name_uuid;
                            historyData.lastEditBy = mutation.name_review.updatedBy;
                            break;
                        case 'TUMOR_NAME_CHANGE':
                            historyData.uuids = tumor.cancerTypes_uuid;
                            historyData.lastEditBy = tumor.cancerTypes_review.updatedBy;
                            break;
                        case 'TREATMENT_NAME_CHANGE':
                            historyData.uuids = treatment.name_uuid;
                            historyData.lastEditBy = treatment.name_review.updatedBy;
                            break;
                    }
                }
                return { evidences: evidences, historyData: historyData };
            };
            function formArticles(data) {
                var description = data.description;
                var abstractResults = FindRegex.result(description);
                var tempAbstract;
                for (var i = 0; i < abstractResults.length; i++) {
                    tempAbstract = abstractResults[i];
                    switch (tempAbstract.type) {
                        case 'pmid':
                            data.articles.push({
                                pmid: tempAbstract.id
                            });
                            break;
                        case 'abstract':
                            data.articles.push({
                                abstract: tempAbstract.id,
                                link: tempAbstract.link
                            });
                            break;
                    }
                }
            }
            function validateTimeFormat(updateTime) {
                var tempTime = new Date(updateTime);
                if (tempTime instanceof Date && !isNaN(tempTime.getTime())) {
                    updateTime = tempTime.getTime();
                } else {
                    // handle the case of time stamp in string format
                    tempTime = new Date(Number(updateTime));
                    if (tempTime instanceof Date && !isNaN(tempTime.getTime())) {
                        updateTime = tempTime.getTime();
                    } else {
                        updateTime = new Date().getTime();
                    }
                }
                return updateTime.toString();
            }

            function setReviewModeInterval() {
                $interval.cancel($scope.reviewMoeInterval);
                $scope.reviewMoeInterval = $interval(function () {
                    if ($rootScope.reviewMode) {
                        $scope.review();
                        $interval.cancel($scope.reviewMoeInterval);
                    }
                }, 1000 * 60 * 15);
            }
            function acceptItem(arr, uuid) {
                _.each(arr, function (item) {
                    if ($rootScope.geneMeta.review[item.uuid]) {
                        delete item.reviewObj.lastReviewed;
                        delete $rootScope.geneMeta.review[item.uuid];
                        ReviewResource.accepted.push(item.uuid);
                    }
                });
                if (uuid) {
                    ReviewResource.accepted.push(uuid);
                }
            }
            $scope.modelUpdate = function (type, mutationAdded, tumorAdded, tiAdded, treatmentAdded) {
                var data = getRealtimeRef(type, mutationAdded, tumorAdded, tiAdded, treatmentAdded);
                var mutation = data.mutation;
                var tumor = data.tumor;
                var ti = data.ti;
                var treatment = data.treatment;
                switch (type) {
                    case 'GENE_SUMMARY':
                        acceptItem([{ reviewObj: $scope.gene.summary_review, uuid: $scope.gene.summary_uuid }], $scope.gene.summary_uuid);
                        break;
                    case 'GENE_BACKGROUND':
                        acceptItem([{ reviewObj: $scope.gene.background_review, uuid: $scope.gene.background_uuid }], $scope.gene.background_uuid);
                        break;
                    case 'GENE_TYPE':
                        acceptItem([{ reviewObj: $scope.gene.type.tsg_review, uuid: $scope.gene.type.tsg_uuid }, { reviewObj: $scope.gene.type.ocg_review, uuid: $scope.geneFire.type.ocg_uuid }], $scope.geneFire.type_uuid);
                        break;
                    case 'MUTATION_EFFECT':
                        acceptItem([{ reviewObj: mutation.mutation_effect.oncogenic_review, uuid: mutation.mutation_effect.oncogenic_uuid },
                        { reviewObj: mutation.mutation_effect.effect_review, uuid: mutation.mutation_effect.effect_uuid },
                        { reviewObj: mutation.mutation_effect.description_review, uuid: mutation.mutation_effect.description_uuid }], mutation.mutation_effect_uuid);
                        break;
                    case 'TUMOR_TYPE_SUMMARY':
                        acceptItem([{ reviewObj: tumor.summary_review, uuid: tumor.summary_uuid }], tumor.summary_uuid);
                        break;
                    case 'PROGNOSTIC_IMPLICATION':
                        acceptItem([{ reviewObj: tumor.prognostic.description_review, uuid: tumor.prognostic.description_uuid },
                        { reviewObj: tumor.prognostic.level_review, uuid: tumor.prognostic.level_uuid }], tumor.prognostic_uuid);
                        break;
                    case 'DIAGNOSTIC_IMPLICATION':
                        acceptItem([{ reviewObj: tumor.diagnostic.description_review, uuid: tumor.diagnostic.description_uuid },
                        { reviewObj: tumor.diagnostic.level_review, uuid: tumor.diagnostic.level_uuid }], tumor.diagnostic_uuid);
                        break;
                    case 'Standard implications for sensitivity to therapy':
                    case 'Standard implications for resistance to therapy':
                    case 'Investigational implications for sensitivity to therapy':
                    case 'Investigational implications for resistance to therapy':
                        if (!treatment) {
                            acceptItem([{ reviewObj: ti.description_review, uuid: ti.description_uuid }], ti.description_uuid);
                        } else {
                            acceptItem([{ reviewObj: treatment.name_review, uuid: treatment.name_uuid },
                            { reviewObj: treatment.level_review, uuid: treatment.level_uuid },
                            { reviewObj: treatment.propagation_review, uuid: treatment.propagation_uuid },
                            { reviewObj: treatment.indication_review, uuid: treatment.indication_uuid },
                            { reviewObj: treatment.description_review, uuid: treatment.description_uuid }], treatment.name_uuid);
                        }
                        break;
                    case 'MUTATION_NAME_CHANGE':
                        acceptItem([{ reviewObj: mutation.name_review, uuid: mutation.name_uuid }], mutation.name_uuid);
                        break;
                    case 'TUMOR_NAME_CHANGE':
                        acceptItem([{ reviewObj: tumor.cancerTypes_review, uuid: tumor.cancerTypes_uuid }], tumor.cancerTypes_uuid);
                        break;
                    case 'TREATMENT_NAME_CHANGE':
                        acceptItem([{ reviewObj: treatment.name_review, uuid: treatment.name_uuid }], treatment.name_uuid);
                        break;
                    case 'mutation':
                    case 'tumor':
                    case 'treatment':
                        acceptSection(type, mutation, tumor, ti, treatment);
                        break;
                    default:
                        break;
                }
                // mainUtils.updateLastSavedToDB();
            };
            /*
            * This function is used to collect uuids for specified section.
            * */
            function getUUIDsByType(type, mutation, tumor, TI, treatment) {
                switch (type) {
                    case 'mutation':
                        return collectUUIDs(type, mutation, []);
                    case 'tumor':
                        return collectUUIDs(type, tumor, []);
                    case 'TI':
                        return collectUUIDs(type, TI, []);
                    case 'treatment':
                        return collectUUIDs(type, treatment, []);
                    case 'GENE_SUMMARY':
                        return [$scope.gene.summary_uuid];
                    case 'GENE_BACKGROUND':
                        return [$scope.gene.background_uuid];
                    case 'MUTATION_EFFECT':
                        return [mutation.mutation_effect.oncogenic_uuid, mutation.mutation_effect.effect_uuid, mutation.mutation_effect.description_uuid];
                    case 'PROGNOSTIC_IMPLICATION':
                        return [tumor.prognostic_uuid];
                    case 'DIAGNOSTIC_IMPLICATION':
                        return [tumor.diagnostic_uuid];
                }
            };
            /*
            * This function is used to form evidence models, which would be used for api call
            * */
            function formSectionEvidencesByType(type, mutation, tumor, TI, treatment) {
                var evidences = {};
                var historyData = { operation: 'add' };
                switch (type) {
                    case 'mutation':
                        historyData.location = mutation.name;
                        historyData.lastEditBy = mutation.name_review.updatedBy;
                        formSectionEvidences(type, mutation, tumor, TI, treatment, evidences, historyData);
                        break;
                    case 'tumor':
                        historyData.location = historyStr(mutation, tumor);
                        historyData.lastEditBy = tumor.cancerTypes_review.updatedBy;
                        formSectionEvidences(type, mutation, tumor, TI, treatment, evidences, historyData);
                        break;
                    case 'TI':
                        formSectionEvidences(type, mutation, tumor, TI, treatment, evidences, historyData);
                        break;
                    case 'treatment':
                        historyData.location = historyStr(mutation, tumor) + ', ' + TI.name + ', ' + treatment.name;
                        historyData.lastEditBy = treatment.name_review.updatedBy;
                        formSectionEvidences(type, mutation, tumor, TI, treatment, evidences, historyData);
                        break;
                    case 'GENE_SUMMARY':
                    case 'GENE_BACKGROUND':
                        formEvidencesByType([type], null, null, null, null, evidences, historyData);
                        break;
                    case 'MUTATION_EFFECT':
                    case 'PROGNOSTIC_IMPLICATION':
                    case 'DIAGNOSTIC_IMPLICATION':
                        formEvidencesByType([type], mutation, tumor, TI, treatment, evidences, historyData);
                        break;
                }
                return { evidences: evidences, historyData: historyData };
            }
            function formSectionEvidences(type, mutation, tumor, ti, treatment, evidences, historyData) {
                var typeArr = [];
                var dataArr = [];
                var tempType = '';
                if (type === 'mutation') {
                    typeArr = ['MUTATION_EFFECT'];
                    dataArr = mutation.tumors;
                    tempType = 'tumor';
                }
                if (type === 'tumor') {
                    typeArr = ['TUMOR_TYPE_SUMMARY', 'PROGNOSTIC_IMPLICATION', 'DIAGNOSTIC_IMPLICATION'];
                    dataArr = tumor.TIs;
                    tempType = 'TI';
                }
                if (type === 'TI') {
                    typeArr = [ti.name];
                    dataArr = ti.treatments;
                    tempType = 'treatment';
                    formEvidencesByType(typeArr, mutation, tumor, ti, null, evidences, historyData);
                }
                if (type === 'treatment') {
                    typeArr = [ti.name];
                }
                formEvidencesByType(typeArr, mutation, tumor, ti, treatment, evidences, historyData);
                _.each(dataArr, function (item) {
                    if (type === 'mutation') tumor = item;
                    if (type === 'tumor') ti = item;
                    if (type === 'TI') treatment = item;
                    formSectionEvidences(tempType, mutation, tumor, ti, treatment, evidences, historyData);
                });
            };
            function formEvidencesByType(types, mutation, tumor, TI, treatment, evidences, historyData) {
                _.each(types, function (type) {
                    var getEvidenceResult = $scope.getEvidence(type, mutation, tumor, TI, treatment);
                    var tempEvidences = getEvidenceResult.evidences;
                    var historyDataItem = getEvidenceResult.historyData;
                    if (!_.isEmpty(tempEvidences)) {
                        evidences = _.extend(evidences, tempEvidences);
                        if (!historyData.uuids) {
                            historyData.uuids = historyDataItem.uuids;
                        } else {
                            historyData.uuids += ',' + historyDataItem.uuids;
                        }
                    }

                });
            };
            function setUUIDInMeta(uuid) {
                if (!uuid) return;
                var tempMapping = $rootScope.metaModel.createMap();
                tempMapping.set('review', true);
                $rootScope.geneMetaData.set(uuid, tempMapping);
            }
            function acceptSection(type, mutation, tumor, ti, treatment) {
                var tempUUIDs = getUUIDsByType(type, mutation, tumor, ti, treatment);
                ReviewResource.accepted = _.union(ReviewResource.accepted, tempUUIDs);
                removeUUIDs(tempUUIDs);
                acceptSectionItems(type, mutation, tumor, ti, treatment, true);
            }
            function clearReview(arr) {
                _.each(arr, function (item) {
                    if (item) {
                        delete item.lastReviewed;
                    }
                });
            }
            function acceptSectionItems(type, mutation, tumor, ti, treatment, firstLayer) {
                switch (type) {
                    case 'mutation':
                        ReviewResource.accepted.push(mutation.name_uuid);
                        delete mutation.name_review.added;
                        clearReview([mutation.name_review, mutation.mutation_effect.oncogenic_review, mutation.mutation_effect.effect_review, mutation.mutation_effect.description_review]);
                        _.each(mutation.tumors, function (tumor) {
                            acceptSectionItems('tumor', mutation, tumor, ti, treatment);
                        });
                        break;
                    case 'tumor':
                        ReviewResource.accepted.push(tumor.cancerTypes_uuid);
                        delete tumor.cancerTypes_review.added;
                        clearReview([tumor.cancerTypes_review, tumor.summary_review, tumor.prognostic.level_review, tumor.prognostic.description_review, tumor.diagnostic.level_review, tumor.diagnostic.description_review]);
                        _.each(tumor.TIs, function (ti) {
                            clearReview([ti.description_review]);
                            _.each(ti.treatments, function (treatment) {
                                acceptSectionItems('treatment', mutation, tumor, ti, treatment);
                            });
                        });
                        break;
                    case 'treatment':
                        delete treatment.name_review.added;
                        ReviewResource.accepted = _.union(ReviewResource.accepted, [treatment.name_uuid, treatment.level_uuid, treatment.indication_uuid, treatment.description_uuid]);
                        clearReview([treatment.name_review, treatment.level_review, treatment.indication_review, treatment.description_review]);
                        if (firstLayer) {
                            $scope.updatePriority(ti.treatments);
                        }
                        break;
                }
            }
            function getRealtimeRef(type, mutationAdded, tumorAdded, tiAdded, treatmentAdded) {
                var mutation = '';
                var tumor = '';
                var ti = '';
                var treatment = '';
                _.some($scope.gene.mutations, function (mutationRef) {
                    if (mutationRef.name_uuid === mutationAdded.name_uuid) {
                        mutation = mutationRef;
                        if (tumorAdded) {
                            _.some(mutationRef.tumors, function (tumorRef) {
                                if (tumorAdded.cancerTypes_uuid === tumorRef.cancerTypes_uuid) {
                                    tumor = tumorRef;
                                    if (tiAdded) {
                                        _.some(tumorRef.TIs, function (tiRef) {
                                            if (tiAdded.name_uuid === tiRef.name_uuid) {
                                                ti = tiRef;
                                                _.some(tiRef.treatments, function (treatmentRef) {
                                                    if (treatmentAdded.name_uuid === treatmentRef.name_uuid) {
                                                        treatment = treatmentRef;
                                                        return true;
                                                    }
                                                });
                                                return true;
                                            }
                                        });
                                    }
                                    return true;
                                }
                            });
                        }
                        return true;
                    }
                });
                return {
                    mutation: mutation,
                    tumor: tumor,
                    ti: ti,
                    treatment: treatment
                }
            }

            $scope.acceptAdded = function (type, mutationAdded, tumorAdded, tiAdded, treatmentAdded) {
                var data = getRealtimeRef(type, mutationAdded, tumorAdded, tiAdded, treatmentAdded);
                var mutation = data.mutation;
                var tumor = data.tumor;
                var ti = data.ti;
                var treatment = data.treatment;
                if (!$scope.status.isDesiredGene) {
                    acceptSection(type, mutation, tumor, ti, treatment);
                    return;
                }
                var tempEvidences = formSectionEvidencesByType(type, mutation, tumor, ti, treatment);
                var evidences = tempEvidences.evidences;
                var historyData = [tempEvidences.historyData];
                if (_.isEmpty(evidences)) {
                    acceptSection(type, mutation, tumor, ti, treatment);
                    return;
                }
                var loadingUUID;
                switch (type) {
                    case 'mutation':
                        loadingUUID = mutation.name_uuid;
                        break;
                    case 'tumor':
                        loadingUUID = tumor.cancerTypes_uuid;
                        break;
                    case 'treatment':
                        loadingUUID = treatment.name_uuid;
                        break;
                }
                if (loadingUUID) {
                    ReviewResource.loading.push(loadingUUID);
                }
                DatabaseConnector.updateEvidenceBatch(evidences, historyData, function (result) {
                    acceptSection(type, mutation, tumor, ti, treatment);
                    ReviewResource.loading = _.without(ReviewResource.loading, loadingUUID);
                }, function (error) {
                    ReviewResource.loading = _.without(ReviewResource.loading, loadingUUID);
                    dialogs.error('Error', 'Failed to update to database! Please contact the developer.');
                });
            };
            $scope.rejectAdded = function (type, mutation, tumor, ti, treatment) {
                var dlg = dialogs.confirm('Reminder', 'Are you sure you want to reject this change?');
                dlg.result.then(function () {
                    removeModel(type, mutation, tumor, ti, treatment);
                    var tempUUIDs = getUUIDsByType(type, mutation, tumor, ti, treatment);
                    removeUUIDs(tempUUIDs);
                });
            };
            function clearRollbackLastReview(reviewObjs) {
                _.each(reviewObjs, function (reviewObj) {
                    if (reviewObj.rollback === true) {
                        delete reviewObj.lastReviewed;
                    }
                });
            }
            function clearUnnecessartLastReviewed() {
                clearRollbackLastReview([$scope.gene.summary_review, $scope.gene.type_review, $scope.gene.background_review]);
                for (var i = 0; i < $scope.gene.mutations.length; i++) {
                    var mutation = $scope.gene.mutations.get(i);
                    clearRollbackLastReview([mutation.name_review, mutation.mutation_effect.oncogenic_review, mutation.mutation_effect.effect_review, mutation.mutation_effect.description_review]);
                    for (var j = 0; j < mutation.tumors.length; j++) {
                        var tumor = mutation.tumors.get(j);
                        clearRollbackLastReview([tumor.summary_review, tumor.diagnostic_review, tumor.prognostic_review]);
                        for (var k = 0; k < tumor.TIs.length; k++) {
                            var ti = tumor.TIs.get(k);
                            clearRollbackLastReview([ti.description_review]);
                            for (var m = 0; m < ti.treatments.length; m++) {
                                var treatment = ti.treatments.get(m);
                                clearRollbackLastReview([treatment.name_review, treatment.level_review, treatment.indication_review, treatment.description_review]);

                            }
                        }
                    }
                }
            }
            $scope.updateGene = function () {
                $scope.docStatus.savedGene = false;
                clearUnnecessartLastReviewed();
                var gene = stringUtils.getGeneData(this.gene, true, true);
                var vus = stringUtils.getVUSFullData(this.vus, true);
                var params = {};

                if (gene) {
                    params.gene = JSON.stringify(gene);
                }
                if (vus) {
                    params.vus = JSON.stringify(vus);
                }

                DatabaseConnector.updateGene(params, function (result) {
                    $scope.docStatus.savedGene = true;
                    mainUtils.updateLastSavedToDB();
                }, function (result) {
                    $scope.docStatus.savedGene = true;
                    var errorMessage = 'An error has occurred when saving ' +
                        'data, please contact the developer.';

                    // dialogs.error('Error', errorMessage);
                    $rootScope.$emit('oncokbError',
                        {
                            message: 'An error has occurred when saving data. ' +
                                'Gene: ' + $scope.gene.name,
                            reason: JSON.stringify(result)
                        });
                    mainUtils.updateLastSavedToDB();
                });
            };
            $scope.validateTumor = function (mutation, tumor) {
                var exists = false;
                var removed = false;
                var tempTumor;
                var newTumorTypesName = getNewCancerTypesName($scope.meta.newCancerTypes).toLowerCase();
                _.some(mutation.tumors, function (e) {
                    if ($scope.getCancerTypesName(e).toLowerCase() === newTumorTypesName) {
                        exists = true;
                        if (e.name_review.get('removed')) {
                            removed = true;
                            tempTumor = e;
                        } else {
                            removed = false;
                            return true;
                        }
                    }
                });
                if (exists) {
                    if (removed) {
                        dialogs.notify('Warning', 'This tumor just got removed, we will reuse the old one.');
                        tempTumor.name_review.set('removed', false);
                        $rootScope.geneMetaData.delete(tempTumor.name_uuid);
                        return false;
                    } else {
                        dialogs.notify('Warning', 'Tumor type exists.');
                        return false;
                    }
                } else {
                    return true;
                }
            };
            $scope.getTumorDuplication = function (mutation, tumor) {
                var mutationName = mutation.name.toLowerCase();
                var tumorName = $scope.getCancerTypesName(tumor).toLowerCase();
                if ($scope.tumorMessages[mutationName] && $scope.tumorMessages[mutationName][tumorName]) {
                    return $scope.tumorMessages[mutationName][tumorName];
                } else return '';
            };
            /**
             * check the to be added cancer types are empty or not.
             * It is used to disable Add Tumor Types button if applicable
             * **/
            $scope.emptyTT = function () {
                var result = true;
                for (var i = 0; i < $scope.meta.newCancerTypes.length; i++) {
                    var ct = $scope.meta.newCancerTypes[i];
                    if (ct.subtype && ct.subtype.name) {
                        result = false;
                        break;
                    }
                }
                return result;
            };
            function isValidTumor(mutationIndex, newTumorTypesName) {
                var isValid = true;
                var message = '';
                _.some($scope.mutations[mutationIndex].tumors, function (tumor) {
                    if ($scope.getCancerTypesName(tumor) === newTumorTypesName) {
                        isValid = false;
                        message = newTumorTypesName + ' has already been added';
                        return true;
                    }
                });
                if (!isValid) {
                    dialogs.notify('Warning', message);
                }
                return isValid;
            }
            $scope.addTumorType = function (index) {
                var tempArr = [];
                _.each($scope.meta.newCancerTypes, function (ct) {
                    if (ct.subtype.name) {
                        tempArr.push(ct.subtype.name);
                    }
                });
                if (isValidTumor(index, tempArr.sort().join())) {
                    var cancerTypes = [];
                    _.each($scope.meta.newCancerTypes, function (ct) {
                        if (ct.subtype.name) {
                            var tempCode = '';
                            if (ct.subtype.code) {
                                tempCode = ct.subtype.code;
                            }
                            var cancerType = new FirebaseModel.Cancertype(ct.subtype.name, tempCode);
                            cancerTypes.push(cancerType);
                        }
                    });
                    var tumor = new FirebaseModel.Tumor(cancerTypes);
                    tumor.cancerTypes_review = {
                        updatedBy: $rootScope.me.name,
                        updateTime: new Date().getTime(),
                        added: true
                    };
                    if (!$scope.gene.mutations[index].tumors) {
                        $scope.gene.mutations[index].tumors = [];
                    }
                    $scope.gene.mutations[index].tumors.push(tumor);
                    $scope.meta.newCancerTypes = [{
                        subtype: '',
                        oncoTreeTumorTypes: angular.copy($scope.oncoTree.allTumorTypes)
                    }];
                }
            };

            $scope.modifyTumorType = function (tumor, path) {
                var indices = getIndexByPath(path);
                var tumorRef = $scope.gene.mutations[indices[0]].tumors[indices[1]];
                var dlg = dialogs.create('views/modifyTumorTypes.html', 'ModifyTumorTypeCtrl', {
                    tumor: tumor,
                    tumorRef: tumorRef,
                    oncoTree: $scope.oncoTree
                }, {
                        size: 'lg'
                    });
                dlg.result.then(function (name) {
                    console.log('successfully updated tumor type');
                    // write the old cancertype and subtypes to the review model
                }, function () {
                    console.log('failed to updated tumor type');
                });
            };
            function isValidTreatment(indices, newTreatmentName) {
                var isValid = true;
                var message = '';
                _.some($scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments, function (treatment) {
                    if (treatment.name.toLowerCase() === newTreatmentName.toLowerCase()) {
                        isValid = false;
                        message = 'This treament has already been added';
                        return true;
                    }
                });
                if (!isValid) {
                    dialogs.notify('Warning', message);
                }
                return isValid;
            }
            $scope.addTreatment = function (newTreatmentName, path) {
                newTreatmentName = newTreatmentName.trim();
                var indices = getIndexByPath(path);
                var treatment = new FirebaseModel.Treatment(newTreatmentName);
                treatment.name_review = {
                    updatedBy: $rootScope.me.name,
                    updateTime: new Date().getTime(),
                    added: true
                };
                if (!$scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments) {
                    $scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments = [];
                }
                if (isValidTreatment(indices, newTreatmentName)) {
                    $scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments.push(treatment);
                }
            };

            $scope.onFocus = function (e) {
                $timeout(function () {
                    $(e.target).trigger('input');
                    $(e.target).trigger('change'); // for IE
                });
            };
            /**
             * This function is used to check if the review mode header and comparison should be displayed or not.
             * */
            $scope.reviewContentDisplay = function (uuid, name) {
                var result = $rootScope.reviewMode && !mainUtils.processedInReview('accept', uuid) && !mainUtils.processedInReview('reject', uuid) && !mainUtils.processedInReview('inside', uuid) && !mainUtils.processedInReview('add', uuid) && !mainUtils.processedInReview('remove', uuid);
                if (name) {
                    result = result && mainUtils.processedInReview('name', uuid);
                }
                return result;
            };
            $scope.notDecisedYet = function (uuid) {
                return !mainUtils.processedInReview('accept', uuid) && !mainUtils.processedInReview('reject', uuid);
            }

            $scope.addVUSItem = function (newVUSName, newVUSTime) {
                if (newVUSName) {
                    if (isValidVariant(newVUSName)) {
                        var vusItem = new FirebaseModel.VUSItem(newVUSName, $rootScope.me.name, $rootScope.me.email);
                        $scope.vusFire.vus.push(vusItem);
                        $scope.vusUpdate();
                    }
                }
            };

            $scope.getCancerTypesName = function (tumor) {
                var result = [];
                tumor.cancerTypes.forEach(function (cancerType) {
                    result.push(cancerType.name);
                });
                return result.sort().join(', ');
            };

            $scope.getLastReviewedCancerTypesName = mainUtils.getLastReviewedCancerTypesName;

            function getNewCancerTypesName(cancerTypes) {
                var list = [];
                _.each(cancerTypes, function (cancerType) {
                    if (cancerType.subtype && cancerType.subtype.name && cancerType.subtype.name.length > 0) {
                        var str = cancerType.subtype.name;
                        if (cancerType.subtype.code.length > 0) {
                            str += '(' + cancerType.subtype.code + ')';
                        }
                        list.push(str);
                    } else if (cancerType.mainType && cancerType.mainType.name && cancerType.mainType.name.length > 0) {
                        list.push(cancerType.mainType.name);
                    }
                });
                return list.join(', ');
            }
            $scope.remove = function (type, path) {
                $scope.status.processing = true;
                var deletionMessage = 'Are you sure you want to delete this entry?';
                var directlyRemove = false;
                var obj = '';
                var reviewObj = '';
                var uuid = '';
                var indices = getIndexByPath(path);
                if (type === 'mutation') {
                    obj = $scope.gene.mutations[indices[0]];
                    reviewObj = obj.name_review;
                    uuid = $scope.gene.mutations[indices[0]].name_uuid;
                } else if (type === 'tumor') {
                    obj = $scope.gene.mutations[indices[0]].tumors[indices[1]];
                    reviewObj = obj.cancerTypes_review;
                    uuid = $scope.gene.mutations[indices[0]].tumors[indices[1]].cancerTypes_uuid;
                } else if (type === 'treatment') {
                    obj = $scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments[indices[3]];
                    reviewObj = obj.name_review;
                    uuid = $scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments[indices[3]].name_uuid;
                }
                if (reviewObj.added) {
                    directlyRemove = true;
                    deletionMessage += ' This section will be removed directly since it is newly added.';
                }
                var dlg = dialogs.confirm('Confirmation', deletionMessage);
                dlg.result.then(function () {
                    if (directlyRemove) {
                        var uuids = collectUUIDs(type, obj, [], false, false);
                        removeModel({ type: type, path: path, uuids: uuids });
                    } else {
                        reviewObj.removed = true;
                        reviewObj.updatedBy = $rootScope.me.name;
                        reviewObj.updateTime = new Date().getTime();
                        if (_.isUndefined($rootScope.geneMeta.review)) {
                            $rootScope.geneMeta.review = {};
                        }
                        $rootScope.geneMeta.review[uuid] = true;
                    }
                }, function () {
                });
            };
            /**
             * This function is desgined to collect uuid list from a section
             * @param type: one of the three: mutation, tumor or treatment
             * @param obj: corresponding object
             * @param uuids: the array that you want to append uuids to. usually, pass in a empty array
             * @param inside: boolean value, set it to true to exclude its own uuid from getting collected. Otherwise this function will collect all of the uuids
             * @param evidenceUUIDsOnly: boolean value, set it to true to indicate only want to collect evidences uuid inside one section. If not specified, will return all UUIDs besides evidences UUIDs
             * */
            function collectUUIDs(type, obj, uuids, insideOnly, evidenceOnly, sectionOnly) {
                if (type === 'mutation') {
                    if (sectionOnly) {
                        uuids.push(obj.name_uuid);
                        uuids.push(obj.mutation_effect_uuid);
                    } else if (insideOnly) {
                        uuids.push(obj.mutation_effect.oncogenic_uuid);
                        uuids.push(obj.mutation_effect.effect_uuid);
                        uuids.push(obj.mutation_effect.description_uuid);
                    } else if (evidenceOnly) {
                        uuids.push(obj.mutation_effect.oncogenic_uuid);
                        uuids.push(obj.mutation_effect.effect_uuid);
                    } else {
                        uuids.push(obj.name_uuid);
                        uuids.push(obj.mutation_effect.oncogenic_uuid);
                        uuids.push(obj.mutation_effect.effect_uuid);
                        uuids.push(obj.mutation_effect.description_uuid);
                    }
                    _.each(obj.tumors, function (tumor) {
                        collectUUIDs('tumor', tumor, uuids, insideOnly, evidenceOnly, sectionOnly);
                    });
                }
                if (type === 'tumor') {
                    if (sectionOnly) {
                        uuids.push(obj.cancerTypes_uuid);
                        uuids.push(obj.prognostic_uuid);
                        uuids.push(obj.diagnostic_uuid);
                    } else if (insideOnly) {
                        uuids.push(obj.summary_uuid);
                        uuids.push(obj.prognostic.level_uuid);
                        uuids.push(obj.prognostic.description_uuid);
                        uuids.push(obj.diagnostic.level_uuid);
                        uuids.push(obj.diagnostic.description_uuid);
                    } else if (evidenceOnly) {
                        uuids.push(obj.summary_uuid);
                        uuids.push(obj.prognostic_uuid);
                        uuids.push(obj.diagnostic_uuid);
                    } else {
                        uuids.push(obj.cancerTypes_uuid);
                        uuids.push(obj.summary_uuid);
                        uuids.push(obj.prognostic.level_uuid);
                        uuids.push(obj.prognostic.description_uuid);
                        uuids.push(obj.diagnostic.level_uuid);
                        uuids.push(obj.diagnostic.description_uuid);
                    }
                    _.each(obj.TIs, function (ti) {
                        collectUUIDs('TI', ti, uuids, insideOnly, evidenceOnly, sectionOnly);
                    });
                }
                if (type === 'TI') {
                    if (sectionOnly) {
                        uuids.push(obj.name_uuid);
                    } else if (insideOnly) {
                        uuids.push(obj.description_uuid);
                    } else if (evidenceOnly) {
                        uuids.push(obj.description_uuid);
                    } else {
                        uuids.push(obj.name_uuid);
                        uuids.push(obj.description_uuid);
                    }
                    _.each(obj.treatments, function (treatment) {
                        collectUUIDs('treatment', treatment, uuids, insideOnly, evidenceOnly, sectionOnly);
                    });
                }
                if (type === 'treatment') {
                    if (sectionOnly) {
                        uuids.push(obj.name_uuid);
                    } else if (insideOnly) {
                        uuids.push(obj.level_uuid);
                        uuids.push(obj.indication_uuid);
                        uuids.push(obj.description_uuid);
                    } else if (evidenceOnly) {
                        uuids.push(obj.name_uuid);
                    } else {
                        uuids.push(obj.name_uuid);
                        uuids.push(obj.level_uuid);
                        uuids.push(obj.indication_uuid);
                        uuids.push(obj.description_uuid);
                    }
                }
                return uuids;
            }
            $scope.confirmDelete = function (type, mutation, tumor, ti, treatment) {
                var location = '';
                var obj;
                switch (type) {
                    case 'mutation':
                        obj = mutation;
                        location = mutation.name;
                        break;
                    case 'tumor':
                        obj = tumor;
                        location = historyStr(mutation, tumor);
                        break;
                    case 'treatment':
                        obj = treatment;
                        location = historyStr(mutation, tumor) + ', ' + ti.name + ', ' + treatment.name;
                        break;
                }
                var indicies = [];
                _.some($scope.mutations, function (mut, index) {
                    if (mut.name_uuid === mutation.name_uuid) {
                        indicies.push(index);
                        return true;
                    }
                });
                var uuids = collectUUIDs(type, obj, [], false, false);
                if ($scope.status.isDesiredGene) {
                    var historyData = [{ operation: 'delete', lastEditBy: obj.name_review.updatedBy, location: location }];
                    // make the api call to delete evidences
                    var loadingUUID = obj.name_uuid;
                    if (loadingUUID) {
                        ReviewResource.loading.push(loadingUUID);
                    }
                    DatabaseConnector.deleteEvidences(uuids, historyData, function (result) {
                        removeModel({ type: type, indicies: indicies, uuids: uuids });

                        // Update all priority if one of treatments is deleted.
                        if (type && type === 'treatment') {
                            $scope.updatePriority(ti.treatments);
                        }
                        ReviewResource.loading = _.without(ReviewResource.loading, loadingUUID);
                    }, function (error) {
                        dialogs.error('Error', 'Failed to update to database! Please contact the developer.');
                        ReviewResource.loading = _.without(ReviewResource.loading, loadingUUID);
                    });
                } else {
                    removeModel({ type: type, indicies: indicies, uuids: uuids });
                }
            };
            function removeModel(data) {
                var indices = [];
                if (data.indicies) {
                    indices = data.indicies;
                } else if (data.path) {
                    indices = getIndexByPath(data.path);
                }
                if (data.type === 'mutation') {
                    $scope.gene.mutations.splice(indices[0], 1);
                } else if (data.type === 'tumor') {
                    $scope.gene.mutations[indices[0]].tumors.splice(indices[1], 1);
                } else if (data.type === 'treatment') {
                    $scope.gene.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments.splice(indices[3], 1);
                }
                _.each(data.uuids, function (uuid) {
                    if ($rootScope.geneMeta.review[uuid]) {
                        delete $rootScope.geneMeta.review[uuid];
                    }
                });
            }
            function removeUUIDs(uuids) {
                if (uuids && _.isArray(uuids)) {
                    _.each(uuids, function (uuid) {
                        if (uuid) {
                            delete $rootScope.geneMeta.review[uuid];
                        }
                    });
                }
            }
            function getIndexByPath(path) {
                var indices = [];
                _.each(path.split('/'), function (item) {
                    var tempNum = parseInt(item);
                    if (_.isNumber(tempNum) && !_.isNaN(tempNum)) {
                        indices.push(tempNum);
                    }
                });
                for (var i = indices.length; i < 4; i++) {
                    indices.push(-1);
                }
                return indices;
            }
            $scope.cancelDelete = function (type, mutation, tumor, ti, treatment) {
                var dlg = dialogs.confirm('Reminder', 'Are you sure you want to reject this change?');
                dlg.result.then(function () {
                    var tempUUIDs = getUUIDsByType(type, mutation, tumor, ti, treatment);
                    ReviewResource.rejected = _.union(ReviewResource.rejected, tempUUIDs);
                    cancelDelteSection(type, mutation, tumor, ti, treatment);
                });
            };
            function cancelDelteSection(type, mutation, tumor, ti, treatment) {
                switch (type) {
                    case 'mutation':
                        cancelDeleteItem($scope.gene.mutations[$scope.mutIndexByUUID[mutation.name_uuid]]);
                        _.each(mutation.tumors, function (tumor) {
                            if (tumor.cancerTypes_review.removed) {
                                cancelDelteSection('tumor', mutation, tumor, ti, treatment);
                            }
                        });
                        break;
                    case 'tumor':
                        cancelDeleteItem(tumor);
                        _.each(tumor.TIs, function (ti) {
                            _.each(ti.treatments, function (treatment) {
                                if (treatment.name_review.removed) {
                                    cancelDelteSection('treatment', mutation, tumor, ti, treatment);
                                }
                            });
                        });
                        break;
                    case 'treatment':
                        cancelDeleteItem(treatment);
                        break;
                }
            }
            function cancelDeleteItem(obj) {
                delete obj.name_review.removed;
                delete $rootScope.geneMeta.review[obj.name_uuid];
                ReviewResource.removed = _.without(ReviewResource.removed, obj.name_uuid);
            }
            function fetchResults(data) {
                var PMIDs = [];
                var abstracts = [];
                _.each(data, function (item) {
                    if (item.type === 'pmid') {
                        PMIDs.push(item.id);
                    } else if (item.type === 'abstract') {
                        abstracts.push(item.id);
                    }
                });
                PMIDs.sort();
                abstracts.sort();
                return { PMIDs: PMIDs, abstracts: abstracts };
            }

            $scope.getAllCitations = function () {
                var results = [];
                var geneData = JSON.stringify($scope.gene);
                results = fetchResults(FindRegex.result(geneData));
                var annotationPMIDs = results.PMIDs;
                var annotationAbstracts = results.abstracts;

                var vusData = JSON.stringify(stringUtils.getVUSFullData(this.vus));
                results = fetchResults(FindRegex.result(vusData));
                var vusPMIDs = results.PMIDs;
                var vusAbstracts = results.abstracts;
                var hasAnnotation = annotationPMIDs.length + annotationAbstracts.length > 0;
                var hasVUS = vusPMIDs.length + vusAbstracts.length > 0;

                // we only seperate citations information to tabs when both annotation and vus citations exist and there are too much info to fit in one tab
                var tabFlag = hasAnnotation && hasVUS && (annotationPMIDs.length > 80 || annotationAbstracts.length > 10 || vusPMIDs.length > 80 || vusAbstracts.length > 10);
                var messageContent = [];
                if (!hasAnnotation && !hasVUS) {
                    messageContent.push('No information available!');
                } else if (tabFlag) {
                    messageContent.push('<ul class="nav nav-tabs">');
                    if (hasAnnotation) {
                        messageContent.push('<li class="active"><a data-toggle="tab" href="#home"><h4>Annotation</h4></a></li>');
                    }
                    if (hasVUS) {
                        messageContent.push('<li><a data-toggle="tab" href="#menu1"><h4>VUS</h4></a></li>');
                    }
                    messageContent.push('</ul><div class="tab-content">');
                    if (hasAnnotation) {
                        messageContent.push('<div id="home" class="tab-pane fade in active"><h4>PMIDs (' + annotationPMIDs.length + ')</h4><p>' + annotationPMIDs.join(', ') + '</p>');
                        if (annotationAbstracts.length > 0) {
                            messageContent.push('<h4>Abstracts (' + annotationAbstracts.length + ')</h4><p>' + annotationAbstracts.join(', ') + '</p>');
                        }
                        messageContent.push('</div>');
                    }
                    if (hasVUS) {
                        messageContent.push('<div id="menu1" class="tab-pane fade"><h4>PMIDs (' + vusPMIDs.length + ')</h4><p>' + vusPMIDs.join(', ') + '</p>');
                        if (vusAbstracts.length > 0) {
                            messageContent.push('<h4>Abstracts (' + vusAbstracts.length + ')</h4><p>' + vusAbstracts.join(', ') + '</p>');
                        }
                        messageContent.push('</div>');
                    }
                    messageContent.push('</div>');
                } else {
                    if (hasAnnotation) {
                        messageContent.push('<h3 style="color:black">Annotation</h3>');
                        if (annotationPMIDs.length > 0) {
                            messageContent.push('<h4>PMIDs (' + annotationPMIDs.length + ')</h4><p>' + annotationPMIDs.join(', ') + '</p>');
                        }
                        if (annotationAbstracts.length > 0) {
                            messageContent.push('<h4>Abstracts (' + annotationAbstracts.length + ')</h4><p>' + annotationAbstracts.join(', ') + '</p>');
                        }
                    }

                    if (hasVUS) {
                        messageContent.push('<hr/><h3 style="color:black">VUS</h3>');
                        if (vusPMIDs.length > 0) {
                            messageContent.push('<h4>PMIDs (' + vusPMIDs.length + ')</h4><p>' + vusPMIDs.join(', ') + '</p>');
                        }
                        if (vusAbstracts.length > 0) {
                            messageContent.push('<h4>Abstracts (' + vusAbstracts.length + ')</h4><p>' + vusAbstracts.join(', ') + '</p>');
                        }
                    }
                }
                dialogs.notify('All Citations', messageContent.join(''), { size: 'lg' });
            };
            $scope.specifyAnnotation = function () {
                return true;
                var annotationLocation = {};
                setAnnotationResult(annotationLocation, fetchResults(FindRegex.result(this.gene.background)), 'Gene Background');
                var mutations = stringUtils.getGeneData(this.gene, true, false).mutations;
                _.each(mutations, function (mutation) {
                    setAnnotationResult(annotationLocation, fetchResults(FindRegex.result(JSON.stringify(mutation))), mutation.name);
                });
                return annotationLocation;
            };
            function setAnnotationResult(annotationLocation, results, location) {
                _.each([results.PMIDs, results.abstracts], function (annotations) {
                    _.each(annotations, function (annotation) {
                        annotation = annotation.trim();
                        if (_.has(annotationLocation, annotation)) {
                            annotationLocation[annotation].push(location);
                        } else {
                            annotationLocation[annotation] = [location];
                        }
                    });
                });
            }

            $scope.curatorsName = function () {
                return this.gene.curators.map(function (d) {
                    return d.name;
                }).join(', ');
            };

            $scope.curatorsEmail = function () {
                return this.gene.curators.map(function (d) {
                    return d.email;
                }).join(', ');
            };

            $scope.removeCurator = function (index) {
                $scope.gene.curators.remove(index);
            };

            $scope.checkTI = function (TI, status, type) {
                var _status = TI.types.get('status').toString();
                var _type = TI.types.get('type').toString();
                status = status.toString();
                type = type.toString();
                if (_status === status && _type === type) {
                    return true;
                }
                return false;
            };

            $scope.mutationEffectChanged = function (mutationEffect) {
                mutationEffect.addOn.setText('');
            };

            $scope.displayMoveIcon = function (path, type) {
                if (!path || ['top', 'bottom', 'up', 'down'].indexOf(type) === -1) {
                    return false;
                }
                var index = -1;
                var totalLength = 0;
                var indicies = getIndexByPath(path);
                if (indicies[1] === -1) {
                    // mutation section
                    index = indicies[0];
                    if ($scope.mutations) {
                        totalLength = $scope.mutations.length;
                    }
                } else if (indicies[2] === -1) {
                    // tumor section
                    index = indicies[1];
                    if ($scope.mutations[indicies[0]].tumors) {
                        totalLength = $scope.mutations[indicies[0]].tumors.length;
                    }
                } else if (indicies[3] !== -1) {
                    // treatment section
                    index = indicies[3];
                    if ($scope.mutations[indicies[0]].tumors[indicies[1]].TIs[indicies[2]].treatments) {
                        totalLength = $scope.mutations[indicies[0]].tumors[indicies[1]].TIs[indicies[2]].treatments.length;
                    }
                }
                switch (type) {
                    case 'top':
                        if (index <= 1) {
                            return false;
                        } else {
                            return true;
                        }
                    case 'bottom':
                        if (index >= totalLength - 2) {
                            return false;
                        } else {
                            return true;
                        }
                    case 'up':
                        if (index === 0) {
                            return false;
                        } else {
                            return true;
                        }
                    case 'down':
                        if (index === totalLength - 1) {
                            return false;
                        } else {
                            return true;
                        }
                    default:
                        return false;
                }
            }
            $scope.displayMove = true;
            $scope.reArrangeSections = function () {
                $scope.displayMove = !$scope.displayMove;
            }
            $scope.move = function (angleType, uuid, path) {
                $scope.status.processing = true;
                var dataList;
                var index;
                var moveIndex;
                var type = '';
                var indicies = getIndexByPath(path);
                if (indicies[1] === -1) {
                    // mutation section
                    dataList = this.mutations;
                    index = indicies[0];
                } else if (indicies[2] === -1) {
                    // tumor section
                    dataList = this.mutations[indicies[0]].tumors;
                    index = indicies[1];
                } else if (indicies[3] !== -1) {
                    // treatment section
                    dataList = this.mutations[indicies[0]].tumors[indicies[1]].TIs[indicies[2]].treatments;
                    index = indicies[3];
                    type = 'treatment';
                }
                switch (angleType) {
                    case 'up':
                        moveIndex = index - 1;
                        break;
                    case 'down':
                        moveIndex = index + 1;
                        break;
                    case 'top':
                        moveIndex = 0;
                        break;
                    case 'bottom':
                        moveIndex = dataList.length;
                        break;
                }
                if (angleType === 'up' || angleType === 'down') {
                    var tempObj = _.clone(dataList[index]);
                    dataList[index] = _.clone(dataList[moveIndex]);
                    dataList[moveIndex] = tempObj;
                } else if (angleType === 'top') {
                    var tempObj = _.clone(dataList[index]);
                    for (var i = index; i > 0; i--) {
                        dataList[i] = _.clone(dataList[i - 1]);
                    }
                    dataList[0] = tempObj;
                } else if (angleType === 'bottom') {
                    var tempObj = _.clone(dataList[index]);
                    for (var i = index; i < dataList.length - 1; i++) {
                        dataList[i] = _.clone(dataList[i + 1]);
                    }
                    dataList[dataList.length - 1] = tempObj;
                }
                if (type === 'treatment') {
                    // $scope.updatePriority(dataList, index, moveIndex);
                }
            }
            $scope.generatePDF = function () {
                jspdf.create(stringUtils.getGeneData(this.gene, true, false));
            };

            /* eslint no-unused-vars: 0*/
            $scope.changeIsOpen = function (target) {
                target = !target;
            };
            $rootScope.savingGene = false;
            // emptySectionsUUIDs is still TBD in terms of where it should be used 
            var emptySectionsUUIDs = {};
            $scope.isEmptySection = function (obj, type) {
                if (type === 'mutation_effect') {
                    if (obj.oncogenic || obj.effect || obj.description || obj.short) {
                        return false;
                    }
                    emptySectionsUUIDs[obj.mutation_effect_uuid] = true;
                } else if (type === 'diagnostic' || type === 'prognostic') {
                    if (obj[type].level || obj[type].description || obj[type].short) {
                        return false;
                    }
                    emptySectionsUUIDs[obj[type + '_uuid']] = true;
                } else if (type === 'ti') {
                    if (obj.description || obj.treatments) {
                        return false;
                    }
                    emptySectionsUUIDs[obj.name_uuid] = true;
                } else if (type === 'treatment') {
                    if (obj.level || obj.indication || obj.description || obj.short) {
                        return false;
                    }
                    emptySectionsUUIDs[obj.name_uuid] = true;
                }
                return true;
            };
            function redoEmptyCheck(obj, type) {
                $timeout(function () {
                    $scope.isEmptySection(obj, type);
                }, 500);
            }

            $scope.curatedIconClick = function (event, status) {
                status.set('curated', !status.get('curated'));
            };

            $scope.mutationNameEditable = function (mutationName) {
                return $scope.fileEditable && !($scope.userRole !== 8 &&
                    $scope.suggestedMutations.indexOf(mutationName) !== -1);
            };

            /**
             * Get priorities based on uuid and treatment name.
             *
             * @param Array list Google drive collaborative list
             * @param Object unapprovedUuids List of uuids that even unapproved, when calculate the priority should be incldued. This will be used when user approves the section.
             * @return Object
             */
            function getNewPriorities(list, unapprovedUuids) {
                var priorities = {};
                var count = 1;

                if (!_.isArray(unapprovedUuids)) {
                    unapprovedUuids = [];
                }
                _.each(list, function (treatmentSec, index) {
                    var name = treatmentSec.name_review && treatmentSec.name_review.lastReviewed ? treatmentSec.name_review.lastReviewed : treatmentSec.name;
                    var uuid = treatmentSec.name_uuid;
                    var notNewlyAdded = true;
                    if (treatmentSec.name_review && treatmentSec.name_review.added) {
                        notNewlyAdded = false;
                    }
                    if (notNewlyAdded || unapprovedUuids.indexOf(uuid) !== -1) {
                        priorities[uuid] = {};
                        _.each(name.split(','), function (t) {
                            var treatment = t.trim();
                            priorities[uuid][treatment] = count;
                            count++;
                        });
                    }
                });
                return priorities;
            }

            /**
             * Update treatment priority
             * @param list list Google drive collaborative list
             * @param integer index Original index
             * @param integer moveIndex Index is about move before that index
             * @return Promise
             */
            $scope.updatePriority = function (list, index, moveIndex) {
                var deferred = $q.defer();

                // if treatment is only moved one position,
                // only two sections will be affected.
                // Otherwise, all treatments should be updated.
                // Update priorities
                var priorities = getNewPriorities(list);
                var postData = {};

                index = Number.isInteger(index) ? index : -1;
                moveIndex = Number.isInteger(moveIndex) ? moveIndex : -1;

                if (Math.abs(index - moveIndex) === 1) {
                    var indexUUid = list[index].name_uuid;
                    var moveIndexUUid = list[moveIndex].name_uuid;

                    // If one of the section is not approved yet,
                    // no need to trigger update.
                    if (priorities[indexUUid] && priorities[moveIndexUUid]) {
                        postData[indexUUid] = priorities[indexUUid];
                        postData[moveIndexUUid] = priorities[moveIndexUUid];
                    }
                } else {
                    postData = priorities;
                }

                if ($scope.status.isDesiredGene && Object.keys(postData).length > 0) {
                    DatabaseConnector
                        .updateEvidenceTreatmentPriorityBatch(
                            postData
                            , function () {
                                // Nothing needs to be done here
                                console.log('Succeed to update priority.');
                                deferred.resolve();
                            }, function (error) {
                                // Something goes wrong, this needs to be stored into meta file for future update.
                                console.log('Failed to update priority.');
                                DatabaseConnector.sendEmail({
                                    sendTo: 'dev.oncokb@gmail.com',
                                    subject: 'Error when updating treatments\' priority',
                                    content: JSON.stringify(postData)
                                },
                                    function (result) {
                                        deferred.rejected(error);
                                    },
                                    function (error) {
                                        deferred.rejected(error);
                                    }
                                );
                            });
                } else {
                    deferred.resolve();
                }
                return deferred.promise;
            }
            // Calculate number of 'number' elements within the object
            function getNoNKeys(object) {
                var count = 0;
                for (var key in object) {
                    if (!isNaN(key)) {
                        count++;
                    }
                }
                return count;
            }

            function migrateGeneStatusPosition(object, indexRemoved) {
                if (angular.isNumber(indexRemoved)) {
                    var indexes = [];
                    for (var key in object) {
                        if (!isNaN(key) && Number(key) > indexRemoved) {
                            indexes.push(Number(key));
                        }
                    }

                    indexes.sort(function (a, b) {
                        return a - b;
                    }).forEach(function (e) {
                        object[e - 1] = object[e];
                    });

                    delete object[indexes.pop()];
                    return object;
                }
                return false;
            }

            function checkNumWatchers() {
                var root = angular.element(document.getElementsByTagName('body'));

                var watchers = [];

                var f = function (element) {
                    angular.forEach(['$scope', '$isolateScope'], function (scopeProperty) {
                        if (element.data() && element.data().hasOwnProperty(scopeProperty)) {
                            angular.forEach(element.data()[scopeProperty].$$watchers, function (watcher) {
                                watchers.push(watcher);
                            });
                        }
                    });

                    angular.forEach(element.children(), function (childElement) {
                        f(angular.element(childElement));
                    });
                };

                f(root);

                // Remove duplicate watchers
                var watchersWithoutDuplicates = [];
                angular.forEach(watchers, function (item) {
                    if (watchersWithoutDuplicates.indexOf(item) < 0) {
                        watchersWithoutDuplicates.push(item);
                    }
                });

                console.log(watchersWithoutDuplicates);

                return watchersWithoutDuplicates.length;
            }



            function getSuggestedMutations() {
                var defaultPlaceHolder = 'No suggestion found. Please curate according to literature.';
                DatabaseConnector.getSuggestedVariants()
                    .then(function (resp) {
                        if (_.isArray(resp) && resp.length > 0) {
                            $scope.suggestedMutations = resp;
                        } else {
                            $scope.suggestedMutations = [];
                        }
                    }, function () {
                        $scope.suggestedMutations = [];
                    })
                    .finally(function () {
                        if ($scope.suggestedMutations.length === 0) {
                            $scope.addMutationPlaceholder = defaultPlaceHolder;
                        }
                    });
            }
            function loadMetaFile(callback) {
                if (!$rootScope.metaData) {
                    loadFiles.load(['all']).then(function (result) {
                        assignMeta(callback);
                    }, function (error) {
                        $scope.fileEditable = false;
                        callback();
                    });
                } else {
                    assignMeta(callback);
                }

            }
            function assignMeta(callback) {
                if (!$rootScope.metaData.get($scope.fileTitle)) {
                    var tempMap = $rootScope.metaModel.createMap();
                    $rootScope.metaData.set($scope.fileTitle, tempMap);
                }
                $rootScope.geneMetaData = $rootScope.metaData.get($scope.fileTitle);
                if (!$rootScope.geneMetaData.has('currentReviewer') || $rootScope.geneMetaData.get('currentReviewer').type !== 'EditableString') {
                    $rootScope.geneMetaData.set('currentReviewer', $rootScope.metaModel.createString(''));
                }
                if (!$rootScope.timeStamp.has($scope.fileTitle)) {
                    $rootScope.timeStamp.set($scope.fileTitle, $rootScope.metaModel.createMap());
                }
                $rootScope.geneTimeStamp = $rootScope.timeStamp.get($scope.fileTitle);
                var tempReviewer = $rootScope.geneMetaData.get('currentReviewer');
                tempReviewer.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, reviewerChange);
                tempReviewer.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, reviewerChange);
                callback();
            }

            function bindDocEvents() {
                $scope.realtimeDocument.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_JOINED, displayCollaboratorEvent);
                $scope.realtimeDocument.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_LEFT, displayCollaboratorEvent);
                $scope.realtimeDocument.addEventListener(gapi.drive.realtime.EventType.DOCUMENT_SAVE_STATE_CHANGED, saveStateChangedEvent);
                $scope.model.addEventListener(gapi.drive.realtime.EventType.UNDO_REDO_STATE_CHANGED, onUndoStateChanged);
                $scope.gene.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, valueChangedEvent);
                $rootScope.metaRealtime.addEventListener(gapi.drive.realtime.EventType.DOCUMENT_SAVE_STATE_CHANGED, saveMetaChangedEvent);
            }
            function reviewerChange() {
                // set gene document to readable only when it s in review
                if (underOthersReview()) {
                    $scope.$emit('interruptedDueToOtherReview');
                } else {
                    // If document is editable again, need to notify the user.
                    if (!$scope.fileEditable && $scope.document.editable) {
                        dialogs.notify('Notification',
                            'You can now continue editing the document. Thanks.');
                    }
                    $scope.fileEditable = $scope.document.editable;
                }
            }
            function saveStateChangedEvent(evt) {
                if ($scope.$$phase) {
                    updateDocStatus(evt);
                } else {
                    $scope.$apply(function () {
                        updateDocStatus(evt);
                    });
                }
            }

            function updateDocStatus(evt) {
                if (evt.isSaving) {
                    documentSaving();
                } else if (!evt.isSaving && !evt.currentTarget.isClosed) {
                    documentSaved();
                } else {
                    documentClosed();
                }
            }

            function saveMetaChangedEvent(evt) {
                if ($rootScope.$$phase) {
                    updateMetaDocStatus(evt);
                } else {
                    $rootScope.$apply(function () {
                        updateMetaDocStatus(evt);
                    });
                }
            }

            function updateMetaDocStatus(evt) {
                if (evt.isSaving) {
                    documentSaving('meta');
                } else if (!evt.isSaving && !evt.currentTarget.isClosed) {
                    documentSaved('meta');
                } else {
                    documentClosed('meta');
                }
            }

            function afterCreateGeneModel() {
                var file = Documents.get({ title: $scope.fileTitle });
                file = file[0];
                // Only allow admins to edit Other Biomarkers Gene Sumarry, Background and Gene Type
                if ($scope.gene.name.trim().toLowerCase() === 'other biomarkers' && $scope.userRole !== 8) {
                    $scope.geneEditable = false;
                }
                $scope.document = file;
                $scope.fileEditable = file.editable;
                $scope.status.rendering = false;
                displayAllCollaborators($scope.realtimeDocument, bindDocEvents);

                if (underReview()) {
                    // This will only happen if the currentReviewer is not empty
                    $scope.fileEditable = false;
                }
                // Add timeout until the collaborator join event is triggered.
                $timeout(function () {
                    if (underOthersReview()) {
                        $scope.$emit('interruptedDueToOtherReview');
                    } else if (underReview()) {
                        // if no other is reviewing the current document,
                        // need to reset the document to initial state.
                        $scope.exitReview();
                    }
                }, 2000);
            }

            function valueChangedEvent(evt) {
                console.log('valueChanged', evt);
                if ($scope.gene) {
                    var hasCurator = false;
                    if ($scope.gene.curators && angular.isArray($scope.gene.curators) && $scope.gene.curators.length > 0) {
                        var _array = $scope.gene.curators;
                        for (var i = 0; i < _array.length; i++) {
                            if (_array[i].email === User.email) {
                                hasCurator = true;
                                break;
                            }
                        }

                        if (!hasCurator) {
                            $scope.realtimeDocument.getModel().beginCompoundOperation();
                            var __curator = $scope.realtimeDocument.getModel().create(OncoKB.Curator, User.name, User.email);
                            $scope.gene.curators.push(__curator);
                            $scope.realtimeDocument.getModel().endCompoundOperation();
                        }
                    } else {
                        $scope.realtimeDocument.getModel().beginCompoundOperation();
                        var _curator = $scope.realtimeDocument.getModel().create(OncoKB.Curator, User.name, User.email);
                        $scope.gene.curators.push(_curator);
                        $scope.realtimeDocument.getModel().endCompoundOperation();
                    }
                }
            }

            function displayCollaboratorEvent(evt) {
                switch (evt.type) {
                    case 'collaborator_left':
                        removeCollaborator(evt.collaborator);
                        break;
                    case 'collaborator_joined':
                        addCollaborator(evt.collaborator);
                        break;
                    default:
                        console.info('Unknown event:', evt);
                        break;
                }
                $scope.$apply($scope.collaborators);
            }

            function underOthersReview() {
                var currentReviewer = $rootScope.geneMetaData.get('currentReviewer');
                if (currentReviewer) {
                    var _name = currentReviewer;
                    if (_name &&
                        _name.toUpperCase() !== User.name.toUpperCase() &&
                        hasCollaborator(currentReviewer)) {
                        return true;
                    }
                }
                return false;
            }

            function hasCollaborator(name) {
                var collaborators = $scope.realtimeDocument.getCollaborators();
                if (_.isArray(collaborators)) {
                    for (var i = 0; i < collaborators.length; i++) {
                        if (collaborators[i].displayName.toUpperCase() === name.toUpperCase()) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function underReview() {
                var currentReviewer = $rootScope.geneMetaData.get('currentReviewer');
                if (currentReviewer && currentReviewer) {
                    return true;
                }
                return false;
            }

            function addCollaborator(user) {
                if (!$scope.collaborators.hasOwnProperty(user.userId)) {
                    $scope.collaborators[user.sessionId] = {};
                }
                $scope.collaborators[user.sessionId] = user;
            }

            function removeCollaborator(user) {
                if ($scope.collaborators.hasOwnProperty(user.sessionId)) {
                    delete $scope.collaborators[user.sessionId];
                } else {
                    console.log('Unknown collaborator:', user);
                }
            }

            function displayAllCollaborators(document, callback) {
                var collaborators = document.getCollaborators();
                var collaboratorCount = collaborators.length;
                var _user = {};
                for (var i = 0; i < collaboratorCount; i++) {
                    var user = collaborators[i];
                    if (!$scope.collaborators.hasOwnProperty(user.userId)) {
                        $scope.collaborators[user.sessionId] = {};
                    }
                    $scope.collaborators[user.sessionId] = user;
                    if (user.isMe) {
                        _user = user;
                    }
                }

                if (User.email === 'N/A') {
                    storage.getUserInfo(_user.userId).then(function (userInfo) {
                        User.name = userInfo.displayName;
                        if (angular.isArray(userInfo.emails)) {
                            if (userInfo.emails.length > 0) {
                                User.email = userInfo.emails[0].value;
                            } else {
                                User.email = 'N/A';
                            }
                        } else {
                            User.email = userInfo.emails;
                        }
                        callback();
                    });
                } else {
                    callback();
                }
            }

            function onUndoStateChanged(evt) {
                if (evt.canUndo) {
                    $scope.canUndo = true;
                } else {
                    $scope.canUndo = false;
                }
                if (evt.canRedo) {
                    $scope.canRedo = true;
                } else {
                    $scope.canRedo = false;
                }
            }

            function documentSaving(type) {
                $scope.docStatus.saving = true;
                $scope.docStatus.saved = false;
                $scope.docStatus.closed = false;

                if (type === 'meta') {
                    $scope.metaDocStatus.saved = false;
                }

                if ($rootScope.reviewMode) {
                    setReviewModeInterval();
                }
            }

            function documentSaved(type) {
                $scope.docStatus.saving = false;
                $scope.docStatus.saved = true;
                $scope.docStatus.closed = false;
                $scope.docStatus.updateGene = false;

                if (type === 'meta') {
                    $scope.metaDocStatus.saved = true;
                }
            }

            function documentClosed(type) {
                $scope.docStatus.closed = true;
                $scope.docStatus.saving = false;
                $scope.docStatus.saved = false;
                $scope.fileEditable = false;

                if (type === 'meta') {
                    $scope.metaDocStatus.saved = false;
                }
            }
            function getTumorSubtypes() {
                var tempRes = [];
                DatabaseConnector.getTumorSubtypes().then(function (result) {
                    _.each(result, function (item) {
                        tempRes.push({
                            name: item.name,
                            code: item.code
                        });
                    });
                    $scope.oncoTree.allTumorTypes = tempRes;
                    $scope.meta = {
                        newCancerTypes: [{
                            subtype: '',
                            oncoTreeTumorTypes: tempRes
                        }]
                    };
                });
            }
            getTumorSubtypes();
            function getLevels() {
                var desS = {
                    '': '',
                    '0': $rootScope.meta.levelsDesc['0'],
                    '1': $rootScope.meta.levelsDesc['1'],
                    '2A': $rootScope.meta.levelsDesc['2A'],
                    '2B': $rootScope.meta.levelsDesc['2B'],
                    '3A': $rootScope.meta.levelsDesc['3A'],
                    '3B': $rootScope.meta.levelsDesc['3B'],
                    '4': $rootScope.meta.levelsDesc['4']
                };

                var desR = {
                    '': '',
                    'R1': $rootScope.meta.levelsDesc.R1,
                    'R2': $rootScope.meta.levelsDesc.R2,
                    'R3': $rootScope.meta.levelsDesc.R3
                };

                var levels = {};

                var levelsCategories = {
                    SS: ['', '0', '1', '2A'],
                    SR: ['R1'],
                    IS: ['', '2B', '3A', '3B', '4'],
                    IR: ['R2', 'R3']
                };

                _.each(levelsCategories, function (item, key) {
                    levels[key] = [];
                    for (var i = 0; i < item.length; i++) {
                        var __datum = {};
                        __datum.label = item[i] + (item[i] === '' ? '' : ' - ') + ((['SS', 'IS'].indexOf(key) === -1) ? desR[item[i]] : desS[item[i]]);
                        __datum.value = item[i];
                        levels[key].push(__datum);
                    }
                });
                levels.prognostic = [{
                    value: 'P1',
                    label: 'Px1 - WHO included criteria'
                }, {
                    value: 'P2',
                    label: 'Px2 - ELN included criteria (only for AML, may be combined with Px1)'
                }, {
                    value: 'P3',
                    label: 'Px3 - NCCN included criteria'
                }, {
                    value: 'P4',
                    label: 'Px4 - Compelling peer reviewed literature'
                }];
                levels.diagnostic = [{
                    value: 'D1',
                    label: 'Dx1 - WHO included criteria'
                }, {
                    value: 'D2',
                    label: 'Dx2 - NCCN included criteria'
                }, {
                    value: 'D3',
                    label: 'Dx3 - Compelling peer reviewed literature'
                }];
                return levels;
            }

            function GeneStatusSingleton(isOpen) {
                if (!_.isBoolean(isOpen)) {
                    isOpen = false;
                }
                this.isOpen = isOpen;
            }

            function containVariantInVUS(variantName) {
                var size = $scope.vus.length;

                for (var i = 0; i < size; i++) {
                    if ($scope.vus.get(i).name === variantName) {
                        return true;
                    }
                }

                return false;
            }

            function addVUS() {
                var model = $scope.realtimeDocument.getModel();
                var vus;
                if (model.getRoot().get('vus')) {
                    vus = model.getRoot().get('vus');
                } else {
                    vus = model.createList();
                    model.getRoot().set('vus', vus);
                }
                $scope.vus = vus;
            }

            function isDesiredGene() {
                var _geneName = $scope.gene.name;
                for (var i = 0; i < OncoKB.global.genes.length; i++) {
                    if (OncoKB.global.genes[i].hugoSymbol === _geneName) {
                        $scope.status.isDesiredGene = true;
                        $scope.meta.gene = OncoKB.global.genes[i];
                        break;
                    }
                }
                $rootScope.isDesiredGene = $scope.status.isDesiredGene;
            }

            $scope.fileTitle = $routeParams.geneName;
            $scope.gene = '';
            $scope.vus = '';
            $scope.comments = '';
            $scope.newGene = {};
            $rootScope.collaborators = {};
            $scope.checkboxes = {
                oncogenic: ['Yes', 'Likely', 'Likely Neutral', 'Inconclusive'],
                mutationEffect: ['Gain-of-function', 'Likely Gain-of-function', 'Loss-of-function', 'Likely Loss-of-function', 'Switch-of-function', 'Likely Switch-of-function', 'Neutral', 'Likely Neutral', 'Inconclusive'],
                hotspot: ['TRUE', 'FALSE'],
                TSG: ['Tumor Suppressor'],
                OCG: ['Oncogene']
            };
            $scope.levels = getLevels();
            $scope.fileEditable = false;
            $scope.docStatus = {
                saved: true,
                saving: false,
                closed: false,
                savedGene: true,
                updateGene: false
            };
            $scope.metaDocStatus = {
                saved: true,
                saving: false
            };
            $scope.addMutationPlaceholder = 'Mutation Name';
            $scope.userRole = $rootScope.me.role;
            $rootScope.userRole = $rootScope.me.role;
            $scope.levelExps = {
                SR: $sce.trustAsHtml('<div><strong>Level R1:</strong> ' + $rootScope.meta.levelsDescHtml.R1 + '.<br/>Example 1: Colorectal cancer with KRAS mutation → resistance to cetuximab<br/>Example 2: EGFR-L858R or exon 19 mutant lung cancers with coincident T790M mutation → resistance to erlotinib</div>'),
                IR: $sce.trustAsHtml('<div><strong>Level R2:</strong> ' + $rootScope.meta.levelsDescHtml.R2 + '.<br/>Example: Resistance to crizotinib in a patient with metastatic lung adenocarcinoma harboring a CD74-ROS1 rearrangement (PMID: 23724914).<br/><strong>Level R3:</strong> ' + $rootScope.meta.levelsDescHtml.R3 + '.<br/>Example: Preclinical evidence suggests that BRAF V600E mutant thyroid tumors are insensitive to RAF inhibitors (PMID: 23365119).<br/></div>')
            };
            $scope.showHideButtons = [
                { key: 'proImShow', display: 'Prognostic implications' },
                {
                    key: 'ssShow',
                    display: 'Standard implications for sensitivity to therapy'
                },
                {
                    key: 'srShow',
                    display: 'Standard implications for resistance to therapy'
                },
                {
                    key: 'isShow',
                    display: 'Investigational implications for sensitivity to therapy'
                },
                {
                    key: 'irShow',
                    display: 'Investigational implications for resistance to therapy'
                }
            ];
            $scope.list = [];
            $scope.sortableOptions = {
                stop: function (e, ui) {
                    console.log('dropindex', ui.dropindex);
                    console.log('index', ui.index);
                    console.log(e, ui);
                },
                beforeStop: function (e, ui) {
                    console.log('dropindex', ui.dropindex);
                    console.log('index', ui.index);
                    console.log(e, ui);
                }
                // handle: '> .myHandle'
            };
            $scope.selfParams = {};
            $scope.geneStatus = {};
            $scope.oncoTree = {
                mainTypes: [],
                tumorTypes: {}
            };
            $scope.suggestedMutations = [];
            $scope.meta = {
                gene: {}, // Gene meta info from database
                newCancerTypes: [{
                    mainType: '',
                    subtype: '',
                    oncoTreeTumorTypes: []
                }]
            };
            $scope.status = {
                expandAll: false,
                rendering: true,
                numAccordion: 0,
                isDesiredGene: true,
                hasReviewContent: false, // indicate if any changes need to be reviewed
                mutationChanged: false, // indicate there are changes in mutation section
                processing: false
            };

            $scope.$watch('meta.newCancerTypes', function (n) {
                if (n.length > 0 && (n[n.length - 1].mainType || n[n.length - 1].subtype)) {
                    $scope.meta.newCancerTypes.push({
                        mainType: '',
                        subtype: '',
                        oncoTreeTumorTypes: angular.copy($scope.oncoTree.allTumorTypes)
                    });
                }
                for (var i = n.length - 2; i >= 0; i--) {
                    if (!n[i].mainType && !n[i].subtype) {
                        n.splice(i, 1);
                        i--;
                    }
                }
                function callback(index, result, type) {
                    if (type === 'mainType') {
                        n[index].oncoTreeTumorTypes = result;
                    } else {
                        n[index].mainType = result;
                    }
                    var next = index + 1;
                    if (next < n.length - 1) {
                        if (n[next].subtype) {
                            findMainTypeBySubtype(next, n[next].subtype, callback);
                        } else {
                            findTumorTypeByMainType(next, n[next].mainType, callback);
                        }
                    }
                }

                if (n.length > 1) {
                    if (n[0].subtype) {
                        findMainTypeBySubtype(0, n[0].subtype, callback);
                    } else {
                        findTumorTypeByMainType(0, n[0].mainType, callback);
                    }
                }
            }, true);

            function findTumorTypeByMainType(index, mainType, callback) {
                if (mainType && mainType.name) {
                    if ($scope.oncoTree.tumorTypes.hasOwnProperty(mainType.name)) {
                        if (_.isFunction(callback)) {
                            callback(index, $scope.oncoTree.tumorTypes[mainType.name], 'mainType');
                        }
                    } else {
                        DatabaseConnector.getOncoTreeTumorTypesByMainType(mainType.name)
                            .then(function (result) {
                                if (result.data) {
                                    $scope.oncoTree.tumorTypes[mainType.name] = result.data;
                                    if (_.isFunction(callback)) {
                                        callback(index, result.data, 'mainType');
                                    }
                                }
                            }, function () {
                                if (_.isFunction(callback)) {
                                    callback(index, '', 'mainType');
                                }
                            });
                    }
                } else if (_.isFunction(callback)) {
                    callback(index, '', 'mainType');
                }
            }

            function findMainTypeBySubtype(index, subtype, callback) {
                if (subtype && subtype.mainType && subtype.mainType.name) {
                    var match = -1;
                    for (var i = 0; i < $scope.oncoTree.mainTypes.length; i++) {
                        if ($scope.oncoTree.mainTypes[i].name === subtype.mainType.name) {
                            match = i;
                            break;
                        }
                    }
                    if (_.isFunction(callback)) {
                        callback(index, match > -1 ? $scope.oncoTree.mainTypes[match] : '', 'subtype');
                    }
                } else if (_.isFunction(callback)) {
                    callback(index, '', 'subtype');
                }
            }
            $scope.$watch('fileEditable', function (n, o) {
                if (n !== o) {
                    $scope.geneEditable = n;
                }
            });

            $scope.$watch('meta.newMainType', function (n) {
                if (_.isArray(n) && n.length > 0) {
                    var _tumorTypes = [];
                    var locks = 0;
                    _.each(n, function (mainType) {
                        if ($scope.oncoTree.tumorTypes.hasOwnProperty(mainType.name)) {
                            _tumorTypes = _.union(_tumorTypes, $scope.oncoTree.tumorTypes[mainType.name]);
                        } else {
                            locks++;
                            DatabaseConnector.getOncoTreeTumorTypesByMainType(mainType.name)
                                .then(function (result) {
                                    if (result.data) {
                                        $scope.oncoTree.tumorTypes[mainType.name] = result.data;
                                        _tumorTypes = _.union(_tumorTypes, result.data);
                                    }
                                    locks--;
                                }, function () {
                                    locks--;
                                });
                        }
                    });
                    var interval = $interval(function () {
                        if (locks === 0) {
                            $scope.meta.currentOncoTreeTumorTypes = _tumorTypes;
                            $interval.cancel(interval);
                        }
                    }, 100);
                }
            });
            $scope.tumorsByMutation = {};
            $scope.TIsByTumor = {};
            $scope.treatmentsByII = {};
            $scope.bindTumors = function (obj) {
                $scope.tumorsByMutation[obj.uuid] = $firebaseArray(firebase.database().ref(getRefByPath(obj.path)));
                _.each($scope.tumorsByMutation[obj.uuid], function (tumor) {
                    $scope.initialOpen[tumor.cancerTypes_uuid] = false;
                });
            };
            $scope.bindTIs = function (obj) {
                $scope.TIsByTumor[obj.uuid] = $firebaseArray(firebase.database().ref(getRefByPath(obj.path)));
                _.each($scope.TIsByTumor[obj.uuid], function (ti) {
                    $scope.initialOpen[ti.name_uuid] = false;
                });
            };
            $scope.bindTreatments = function (obj) {
                $scope.treatmentsByII[obj.uuid] = $firebaseArray(firebase.database().ref(getRefByPath(obj.path)));
                _.each($scope.treatmentsByII[obj.uuid], function (treatment) {
                    $scope.initialOpen[treatment.name_uuid] = false;
                });
            }
            function getAllCollaborators() {
                var defer = $q.defer();
                user.getAllUsers().then(function (allUsersInfo) {
                    firebase.database().ref('Meta/collaborators').on('value', function (collaborators) {
                        var allColl = collaborators.val();
                        var tempCollaborators = {};
                        _.each(_.keys(allColl), function (key) {
                            if (allColl[key].indexOf($scope.fileTitle) !== -1) {
                                tempCollaborators[key] = allUsersInfo[key];
                            }
                        });
                        $rootScope.collaborators = tempCollaborators;
                        defer.resolve();
                    }, function (error) {
                        defer.reject(error);
                    });
                }, function (error) {
                    console.log(error);
                    defer.reject(error);
                });

                return defer.promise;
            }
            function getRefByPath(path) {
                var indicies = getIndexByPath(path);
                var result = 'Genes/' + $scope.fileTitle + '/mutations/';
                if (indicies[0] !== -1) {
                    result += indicies[0] + '/tumors';
                    if (indicies[1] !== -1) {
                        result += '/' + indicies[1] + '/TIs';
                        if (indicies[2] !== -1) {
                            result += '/' + indicies[2] + '/treatments';
                        }
                    }
                }
                return result;
            }
            $scope.toggleSection = function (uuid, mutationEffectUUID) {
                if ($scope.status.processing) {
                    $scope.status.processing = false;
                    return;
                }
                if (!$scope.initialOpen[uuid]) {
                    $scope.initialOpen[uuid] = true;
                } else {
                    var panel = document.getElementById(uuid);
                    if (panel.style.display === "none") {
                        panel.style.display = "block";
                    } else {
                        panel.style.display = "none";
                    }
                }
            };
            $scope.setSectionOpenStatus = function (type, uuids) {
                _.each(uuids, function (uuid) {
                    if (type === 'open') {
                        $scope.initialOpen[uuid] = true;
                    }
                    var panel = document.getElementById(uuid);
                    if (panel) {
                        panel.style.display = type === "open" ? "block" : "none";
                    }
                });
            }
            $scope.getAngleClass = function (uuid) {
                var result = "fa fa-angle-right";
                if ($scope.initialOpen[uuid]) {
                    var panel = document.getElementById(uuid);
                    if (!panel || panel.style.display !== "none") {
                        result = "fa fa-angle-down";
                    }
                }
                result += " angleIconStyle";
                return result;
            }
            $scope.initialOpen = {};
            $scope.mutIndexByUUID = {};
            function populateBindings() {
                var deferred1 = $q.defer();
                $firebaseObject(firebase.database().ref("Genes/" + $scope.fileTitle)).$bindTo($scope, "gene").then(function () {
                    deferred1.resolve();
                }, function (error) {
                    deferred1.reject(error);
                });
                $scope.vusItems = $firebaseArray(firebase.database().ref('VUS/' + $scope.fileTitle + '/vus'));
                var deferred3 = $q.defer();
                $firebaseObject(firebase.database().ref('VUS/' + $scope.fileTitle)).$bindTo($scope, "vusFire").then(function () {
                    deferred3.resolve();
                }, function (error) {
                    deferred3.reject(error);
                });
                var deferred4 = $q.defer();
                $scope.mutations = $firebaseArray(firebase.database().ref('Genes/' + $scope.fileTitle + '/mutations'));
                $scope.mutations.$loaded().then(function (success) {
                    $scope.getMutationMessages();
                    _.each($scope.mutations, function (mutation, index) {
                        $scope.initialOpen[mutation.name_uuid] = false;
                        $scope.mutIndexByUUID[mutation.name_uuid] = index;
                    });
                    deferred4.resolve();
                }, function (error) {
                    deferred4.reject(error);
                });
                var deferred5 = $q.defer();
                $firebaseObject(firebase.database().ref('Meta/' + $scope.fileTitle)).$bindTo($rootScope, "geneMeta").then(function () {
                    deferred5.resolve('success');
                }, function (error) {
                    deferred5.reject('Failed to bind meta by gene');
                });
                var deferred6 = $q.defer();
                $firebaseObject(firebase.database().ref('History/' + $scope.fileTitle)).$bindTo($rootScope, "historyRef").then(function () {
                    deferred6.resolve('success');
                }, function (error) {
                    deferred6.reject('Failed to bind history by gene');
                });
                var bindingAPI = [deferred1.promise, deferred3.promise, deferred4.promise, deferred5.promise, deferred6.promise, getAllCollaborators()];
                $q.all(bindingAPI)
                    .then(function (result) {
                        user.setFileeditable([$scope.fileTitle]).then(function (result) {
                            $scope.fileEditable = result[$scope.fileTitle];
                            $scope.status.rendering = false;
                            $rootScope.fileEditable = $scope.fileEditable;
                        }, function (error) {
                            $scope.fileEditable = false;
                            $scope.status.rendering = false;
                        });
                    }, function (error) {
                        console.log('Error happened', error);
                    });
            }
            $scope.getObservePath = function (data) {
                if (data.type === 'gene') {
                    return 'Genes/' + $scope.fileTitle;
                } else if (data.type === 'mutation') {
                    return 'Genes/' + $scope.fileTitle + '/mutations/' + data.index;
                } else if (data.type === 'mutation_effect') {
                    return data.path + '/mutation_effect';
                } else if (data.type === 'tumor') {
                    return data.path + '/tumors/' + data.index;
                } else if (data.type === 'diagnostic') {
                    return data.path + '/diagnostic';
                } else if (data.type === 'prognostic') {
                    return data.path + '/prognostic';
                } else if (data.type === 'ti') {
                    return data.path + '/TIs/' + data.index;
                } else if (data.type === 'treatment') {
                    return data.path + '/treatments/' + data.index;
                }
            };
            $scope.getUUID = function (data) {
                var obj;
                if (data.type === 'gene') {
                    obj = $scope.gene;
                } else {
                    var indices = getIndexByPath(data.path);
                    if (data.type === 'mutation') {
                        obj = $scope.mutations[indices[0]];
                    } else if (data.type === 'mutation_effect') {
                        obj = $scope.mutations[indices[0]].mutation_effect;
                    } else if (data.type === 'tumor') {
                        obj = $scope.mutations[indices[0]].tumors[indices[1]];
                    } else if (data.type === 'diagnostic') {
                        obj = $scope.mutations[indices[0]].tumors[indices[1]].diagnostic;
                    } else if (data.type === 'prognostic') {
                        obj = $scope.mutations[indices[0]].tumors[indices[1]].prognostic;
                    } else if (data.type === 'ti') {
                        obj = $scope.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]];
                    } else if (data.type === 'treatment') {
                        obj = $scope.mutations[indices[0]].tumors[indices[1]].TIs[indices[2]].treatments[indices[3]];
                    }
                }
                return obj[data.key + '_uuid'];
            }
            populateBindings();

            $scope.$on('interruptedDueToOtherReview', function () {
                // if previously the document is editable, need to notify
                // the current user.
                if ($scope.fileEditable) {
                    dialogs.notify('Warning',
                        $rootScope.geneMetaData.get('currentReviewer') +
                        ' started to review the document, ' +
                        'you can not change anything at this moment. ' +
                        'We will notify you once the reviewer finished ' +
                        'the editing. Thanks. ' +
                        'Sorry for any inconvinience.');
                }
                $scope.fileEditable = false;
            });

            $scope.$on('startSaveDataToDatabase', function () {
                $scope.status.saveDataToDatabase = true;
                $scope.geneMainDivStyle.opacity = 0.1;
            });

            $scope.$on('doneSaveDataToDatabase', function () {
                $scope.status.saveDataToDatabase = false;
                $scope.geneMainDivStyle.opacity = 1;
            });

            $scope.$on('$locationChangeStart', function () {
                documentClosed();
            });
            // $window.onbeforeunload = function() {
            //     // If in the review mode, exit the review mode first then
            //     // close the tab.
            //     if ($rootScope.reviewMode) {
            //         $scope.exitReview();
            //     }
            // };
        }]
    )
    .controller('ModifyTumorTypeCtrl', function ($scope, $modalInstance, data, _, OncoKB, $rootScope, user, mainUtils, FirebaseModel) {
        $scope.meta = {
            cancerTypes: data.cancerTypes,
            newCancerTypes: [],
            cancerTypes_review: data.cancerTypes_review,
            cancerTypes_uuid: data.cancerTypes_uuid,
            oncoTree: data.oncoTree
        };

        $scope.cancel = function () {
            $modalInstance.dismiss('canceled');
        }; // end cancel

        $scope.save = function () {
            var cancerTypes = [];
            _.each($scope.meta.newCancerTypes, function (ct) {
                if (ct.subtype.name) {
                    var tempCode = '';
                    if (ct.subtype.code) {
                        tempCode = ct.subtype.code;
                    }
                    var cancerType = new FirebaseModel.Cancertype(ct.subtype.name, tempCode);
                    cancerTypes.push(cancerType);
                }
            });
            data.tumorRef.cancerTypes = cancerTypes;
            $modalInstance.close();
        };

        $scope.$watch('meta.newCancerTypes', function (n) {
            if (n.length > 0 && (n[n.length - 1].subtype)) {
                $scope.meta.newCancerTypes.push({
                    subtype: '',
                    oncoTreeTumorTypes: angular.copy($scope.meta.oncoTree.allTumorTypes)
                });
            }
            for (var i = n.length - 2; i >= 0; i--) {
                if (!n[i].subtype) {
                    if (n[i].subtype !== '') {
                        n.splice(i, 1);
                        i--;
                    }
                }
            }
            function callback(index, mainType, subType, oncoTreeTumorTypes) {
                n[index].oncoTreeTumorTypes = oncoTreeTumorTypes ? oncoTreeTumorTypes : $scope.meta.oncoTree.allTumorTypes;

                if (mainType) {
                    n[index].mainType = mainType;
                }

                var next = index + 1;
                if (next < n.length - 1) {
                    findCancerType(next, n[next].mainType, n[next].subtype, callback);
                }
            }

            if (n.length > 1) {
                findCancerType(0, n[0].mainType, n[0].subtype, callback);
            }
        }, true);

        initNewCancerTypes();

        function findCancerType(index, mainType, subtype, callback) {
            return true;
            var list;
            var _mainType;
            if (mainType && mainType.name) {
                list = $scope.meta.oncoTree.tumorTypes[mainType.name];
            }
            if (!mainType && subtype) {
                _mainType = findMainType(subtype.mainType.name);
            }
            callback(index, _mainType, subtype, list);
        }

        function initNewCancerTypes() {
            var newCancerTypes = [];
            _.each(data.tumor.cancerTypes, function (cancerType) {
                newCancerTypes.push({
                    subtype: {
                        name: cancerType.name,
                        code: cancerType.code
                    },
                    oncoTreeTumorTypes: angular.copy($scope.meta.oncoTree.allTumorTypes)
                });
            });
            newCancerTypes.push({
                subtype: '',
                oncoTreeTumorTypes: angular.copy($scope.meta.oncoTree.allTumorTypes)
            });
            $scope.meta.newCancerTypes = newCancerTypes;
            console.log($scope.meta.newCancerTypes);
        }

        function findMainType(name) {
            for (var i = 0; i < $scope.meta.oncoTree.mainTypes.length; i++) {
                if ($scope.meta.oncoTree.mainTypes[i].name === name) {
                    return $scope.meta.oncoTree.mainTypes[i];
                }
            }
            return '';
        }

        function findSubtype(name) {
            for (var i = 0; i < $scope.meta.oncoTree.allTumorTypes.length; i++) {
                if ($scope.meta.oncoTree.allTumorTypes[i].name === name) {
                    return $scope.meta.oncoTree.allTumorTypes[i];
                }
            }
            return '';
        }
        $scope.invalidTumor = false;
        $scope.tumorDuplicationCheck = function () {
            return true;
            var tumorNameList = [];
            _.each($scope.meta.mutation.tumors, function (tumor) {
                var tempTumorStr = '';
                _.each(tumor.cancerTypes, function (cancerType) {
                    var mainType = cancerType.cancerType;
                    var subtype = cancerType.subtype;
                    var nonEmpty = false;
                    if (mainType) {
                        tempTumorStr += mainType;
                        nonEmpty = true;
                    }
                    if (subtype) {
                        tempTumorStr += subtype;
                        nonEmpty = true;
                    }
                    if (nonEmpty) {
                        tempTumorStr += ';';
                    }
                });
                tumorNameList.push(tempTumorStr);
            });
            var currentTumorStr = '';
            _.each($scope.meta.newCancerTypes, function (cancerType) {
                var mainType = cancerType.mainType;
                var subtype = cancerType.subtype;
                var nonEmpty = false;
                if (mainType) {
                    currentTumorStr += mainType.name;
                    nonEmpty = true;
                }
                if (subtype) {
                    currentTumorStr += subtype.name;
                    nonEmpty = true;
                }
                if (nonEmpty) {
                    currentTumorStr += ';';
                }
            });
            if (tumorNameList.indexOf(currentTumorStr) !== -1) {
                $scope.invalidTumor = true;
            } else {
                $scope.invalidTumor = false;
            }
        };
    });
