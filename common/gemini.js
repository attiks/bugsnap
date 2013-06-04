define(['js/jquery', 'js/knockout'], function ($, ko) {
    var FieldInfo = (function () {
        function FieldInfo(options) {
            this.Id = options.Id;
            this.Caption = ko.observable(options.Caption);
            this.Options = ko.observableArray();
            this.Value = ko.observable();
        }
        return FieldInfo;
    })();

    var Communicator = (function () {
        function Communicator(settings) {
            this.Settings = function () {
                var stored = localStorage['CommunicatorSettings'] ? JSON.parse(localStorage['CommunicatorSettings']) : {};
                return settings || stored;
            };
            this.Url = function () {
                return this.Settings().Url;
            };
            this.Login = function () {
                return this.Settings().Login;
            };
            this.Password = function () {
                return this.Settings().Password;
            };
            this.Key = function () {
                return this.Settings().Key;
            };
            this.Fields = [];
        }
        return Communicator;
    })();

    var GeminiCommunicator = (function (_super) {
        var isFF = window.navigator.userAgent.indexOf('Firefox') != -1;
        GeminiCommunicator.prototype = Object.create(_super.prototype);
        function GeminiCommunicator(settings) {
            _super.call(this, settings);
            this.geminiUrl = function () {
                return this.Url() + '/api/';
            };
            this.geminiUsername = function () {
                return window.btoa(this.Login() + ':' + this.Key());
            };
        }
        GeminiCommunicator.prototype.search = function (query) {
            var data = {
                 SearchKeywords: query,
                 IncludeClosed: "false",
                 Projects: "ALL",
                 MaxItemsToReturn: 10
            };
            return this.ajax(this.geminiUrl() + "items/filtered", data).then(function (data) {
                return $.map(data, function (item) {
                    item.Name = item.IssueKey + " " + (item.Title || item.ComponentName);
                    item.Id = item.Id || item.IssueID;
                    return item;
                });
            });
        };
        GeminiCommunicator.prototype.comment = function (projectId, issueId, comment) {
            var data = {
                ProjectId: projectId,
                IssueId: issueId,
                UserId: "1",
                Comment: comment
            };
            return this.ajax(this.geminiUrl() + "items/" + issueId + "/comments", data);
        };
        GeminiCommunicator.prototype.attach = function (projectId, issueId, fileContent) {
            var data = {
                    ProjectId: projectId,
                    IssueId: issueId,
                    Name: "screenshot.png",
                    ContentType: "image/png",
                    Content: fileContent
                };
            return this.ajax(this.geminiUrl() + "items/" + issueId + "/attachments", data);
        };
        GeminiCommunicator.prototype.create = function (title, description, project, component, type, priority, severity, status) {
            var data = {
                    Title: title,
                    Description: description,
                    ProjectId: project,
                    Components: component,
                    TypeId: type,
                    PriorityId: priority,
                    SeverityId: severity,
                    StatusId: status,
                    ReportedBy: "1"
                };
            return this.ajax(this.geminiUrl() + "items/", data);
        };
        GeminiCommunicator.prototype.loadProjects = function () {
            return this.ajax(this.geminiUrl() + "projects/", null, 'GET').then(function (data) {
                return $.map(data, function (item) {
                    return item.BaseEntity;
                });
            });
        };
        GeminiCommunicator.prototype.loadComponents = function (projectId) {
            return this.ajax(this.geminiUrl() + "projects/" + projectId+ "/components", null, 'GET').then(function (data) {
                var result = ko.utils.arrayMap(data, function (item) {
                    return item.BaseEntity;
                });
                if(result.length == 0) {
                    result.push({});
                }
                return result;
            });
        };
        GeminiCommunicator.prototype.loadMetaData = function (control, templateId) {
            return this.ajax(this.geminiUrl() + control + "/template/" + templateId, null, 'GET');
        };
        GeminiCommunicator.prototype.test = function () {
            return this.loadProjects();
        };
        GeminiCommunicator.prototype.getFields = function () {
            var project = new FieldInfo({Id: 'caption', Caption: 'Project'});
            var component = new FieldInfo({Id: 'component', Caption: 'Component'});
            var type = new FieldInfo({Id: 'type', Caption: 'Type'});
            var priority = new FieldInfo({Id: 'priority', Caption: 'Priority'});
            var severity = new FieldInfo({Id: 'severity', Caption: 'Severity'});
            var status = new FieldInfo({Id: 'status', Caption: 'Status'});
            project.Options(this.loadProjects());
            var templateId = ko.computed(function () {
                var project = project.Value();
                return project? project.TemplateId : null;
            });
            project.Value.subscribe(function (projectId) {
                this.loadComponents(projectId).done(function (data) {
                    component.Options(data);
                });
            }, this);
            templateId.subscribe(function (templateId) {
                this.loadMetaData('type', templateId).done(function (data) {
                    type.Options(data);
                });
                this.loadMetaData('priority', templateId).done(function (data) {
                    priority.Options(data);
                });
                this.loadMetaData('severity', templateId).done(function (data) {
                    severity.Options(data);
                });
                this.loadMetaData('status', templateId).done(function (data) {
                    status.Options(data);
                });
            }, this);
            this.Fields = [project, component, type, priority, severity, status];
            return this.Fields;
        };
        GeminiCommunicator.prototype.ajax = function(url, data, method) {            
            var deferred = $.Deferred();
            var xhr = new XMLHttpRequest();
            xhr.open((method || 'POST'), url, true);
            xhr.setRequestHeader('Accept', "*/*", false);
            if(!isFF){
                xhr.setRequestHeader('Authorization', 'Basic ' + this.geminiUsername());
                xhr.setRequestHeader('Content-Type', 'application/json');
            } else {
                document.cookie = "authorizationCookie=" + this.geminiUsername() + "; path=/";
            }
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        if(xhr.responseText === "null") {
                            deferred.reject('Unable to login using supplied credentials.');
                        } else {
                            deferred.resolve(JSON.parse(xhr.responseText));
                        }
                    } else {
                        if(!xhr.statusText || xhr.statusText == 'timeout' || xhr.statusText == "Not Found") {
                            deferred.reject('Unable to connect to Gemini at specified URL.');
                        } else {
                            deferred.reject('Unable to login using supplied credentials.');
                        }
                    }
                }
            };
            xhr.send(JSON.stringify(data));
            return deferred.promise();
        };
        return GeminiCommunicator;
    })(Communicator);

    var YouTrackCommunicator = (function (_super) {
        YouTrackCommunicator.prototype = Object.create(_super.prototype);
        function YouTrackCommunicator(settings) {
            _super.call(this, settings);
        }
        YouTrackCommunicator.prototype.authenticate = function () {
            return this.ajax(this.Url() + 'rest/user/login', {login: this.Login(), password: this.Password()});
        };
        YouTrackCommunicator.prototype.test = function () {
            return this.authenticate();
        };
        YouTrackCommunicator.prototype.loadProjects = function () {
            return this.ajax(this.Url() + 'rest/project/all', {}, 'GET').then(function (data) {
                return $.map(data, function (item) {
                    return {Id: item.shortName, Name: item.name};
                });
            });
        };
        YouTrackCommunicator.prototype.search = function (query) {
            return this.ajax(this.Url() + 'rest/issue?filter=' + query, {}, 'GET').then(function (data) {
                var getSummary = function (fields) {
                    for (var i = 0; i < fields.length; i++) {
                        var field = fields[i];
                        if (field.name == 'summary') return field.value;
                    }
                    return '';
                };
                return $.map(data.issue, function (item) {
                    return {Id: item.id, Name: getSummary(item.field)};
                });
            });
        };
        YouTrackCommunicator.prototype.getFields = function () {
            var project = new FieldInfo({Id: 'project', Caption: 'Project'});
            this.loadProjects().done(function (data) {
                project.Options(data);
            });
            return [project];
        };
        YouTrackCommunicator.prototype.ajax = function(url, data, method) {
            var deferred = $.Deferred();
            var xhr = new XMLHttpRequest();
            xhr.open((method || 'POST'), url, true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        if(xhr.responseText === "null") {
                            deferred.reject('Unable to login using supplied credentials.');
                        } else {
                            try {
                                deferred.resolve(JSON.parse(xhr.responseText));
                            } catch (e) {
                                deferred.resolve(xhr.responseText);
                            }
                        }
                    } else {
                        if(!xhr.statusText || xhr.statusText == 'timeout' || xhr.statusText == "Not Found") {
                            deferred.reject('Unable to connect to YouTrack at specified URL.');
                        } else {
                            deferred.reject('Unable to login using supplied credentials.');
                        }
                    }
                }
            };
            xhr.send($.param(data));
            return deferred.promise();
        };
        return YouTrackCommunicator;
    })(Communicator);

    var CommunicatorLoader = function (communicatorType) {
        var type = communicatorType || localStorage['CommunicatorType'];
        var result = GeminiCommunicator; // Default one
        switch (type) {
            case 'YouTrack':
                result = YouTrackCommunicator;
                break;
        }
        return result;
    }
    return CommunicatorLoader;
});