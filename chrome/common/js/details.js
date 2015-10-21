define(['lib/jquery', 'lib/knockout', 'lib/knockout.validation', 'comm', 'lib/jquery.ui', 'lib/jquery.loading'],
    function ($, ko, kov, CommunicatorLoader) {

    var DetailsViewModel = (function () {
        function DetailsViewModel(options) {
            this.Parent = options.Parent;
            this.Comment = ko.observable().extend({required: true});
            this.Title = ko.observable().extend({required: true});
            this.Labels = ko.observable().extend({required: false});
            this.Description = ko.observable().extend({required: true});
            this.Issue = ko.observable().extend({required: true});
            this.Type = ko.observable(localStorage['CommunicatorType'] || 'Gemini');
            this.LabelsVisible = ko.computed(function () {
                return this.Type() == 'Gitlab';
            }, this);
            this.IssueId = ko.computed(function () {
                var issue = this.Issue();
                if (issue != null) {
                    return issue.Id;
                }
                return null;
            }, this);
            this.Communicator = new (CommunicatorLoader())();
            this.Fields = this.Communicator.getFields();
            this.FieldsArr = [];
            for (var i in this.Fields) {
                this.FieldsArr.push(this.Fields[i]);
            }
            this.ActiveTab = ko.observable('Create');
            this.init();
        }
        DetailsViewModel.prototype.init = function () {
            var self = this;
            this.CreateErrors = ko.validation.group([this.Title, this.Description, this.Labels]);
            this.AttachErrors = ko.validation.group([this.Issue, this.Comment]);
            $("#issue").autocomplete({
                appendTo: "#issue_dialog",
                minLength: 2,
                source: function(request, response) {
                    var search = self.Communicator.search(request.term);
                    if (search != null) {
                        search.done(function (data) {
                            if(data.constructor != Array) {
                                data = new Array(data);
                            }
                            var labeledData = $.map(data, function (item) {
                                item.label = item.Name;
                                item.value = item.Id;
                                return item;
                            });
                            response(labeledData);
                        });
                    }
                },
                focus: function( event, ui ) {
                    $("#issue").val(ui.item.label);
                    return false;
                },
                select: function(event, ui) {
                    $("#issue").val(ui.item.label);
                    self.Issue(ui.item);
                    return false;
                }
            });
            if (this.Type() == 'Gitlab') {
              $("#labels").autocomplete({
                  appendTo: "#issue_dialog",
                  minLength: 1,
                  source: function(request, response) {
                      var label = self.Communicator.searchLabel(request.term.split(/,\s*/).pop(), self.Fields);
                      if (label != null) {
                          label.done(function (data) {
                              if(data.constructor != Array) {
                                  data = new Array(data);
                              }
                              var labeledData = $.map(data, function (item) {
                                  item.label = item.Name;
                                  item.value = item.Id;
                                  return item;
                              });
                              response(labeledData);
                          });
                      }
                  },
                  focus: function( event, ui ) {
                      return false;
                  },
                  select: function(event, ui) {
                      var terms = this.value.split(/,\s*/);
                      // remove the current input
                      terms.pop();
                      // add the selected item
                      terms.push(ui.item.label);
                      $("#labels").val(terms.join(', '));
                      self.Labels(terms);
                      return false;
                  }
              });
            }
            $("#issue_dialog").dialog(
                {
                    draggable: false,
                    autoOpen: false,
                    width: 500
                }
            );
        };
        DetailsViewModel.prototype.selectCreate = function () {
            this.ActiveTab('Create');
        };
        DetailsViewModel.prototype.selectAttach = function () {
            this.ActiveTab('Attach');
        };
        DetailsViewModel.prototype.send = function () {
            if (this.AttachErrors().length > 0) {
                this.AttachErrors.showAllMessages();
                return;
            }
            var imageData = this.Parent.Editor.getImageData();
            var self = this;
            $("#issue_dialog").showLoading();
            this.Communicator.attach(self.IssueId(), imageData, self.Fields).then(function() {
                return self.Communicator.comment(self.IssueId(), self.Comment(), self.Fields);
            }).done(function () {
                $("#issue_dialog").hideLoading().dialog("close");
                location.href = self.Communicator.getRedirectUrl(self.IssueId(), self.Fields);
            });
        };
        DetailsViewModel.prototype.createIssue = function () {
            if (this.CreateErrors().length > 0) {
                this.CreateErrors.showAllMessages();
                return;
            }
            var imageData = this.Parent.Editor.getImageData();
            var self = this;
            $("#issue_dialog").showLoading();
            var issueId = null;
            var create;
            if (this.Type() == 'Gitlab') {
              create = this.Communicator.create(
                  this.Title(),
                  this.Description(),
                  this.Fields,
                  this.Labels()
              );
            }
            else {
              create = this.Communicator.create(
                  this.Title(),
                  this.Description(),
                  this.Fields
              );
            }
            create.then(function (data) {
                    issueId = data.Id;
                    return self.Communicator.attach(issueId, imageData, self.Fields, true);
                }).done(function () {
                    $("#issue_dialog").hideLoading().dialog("close");
                    location.href = self.Communicator.getRedirectUrl(issueId, self.Fields);
                });
        };
        DetailsViewModel.prototype.showDialog = function () {
            $("#issue_dialog").dialog("open");
        };
        DetailsViewModel.prototype.closeDialog = function () {
            $("#issue_dialog").dialog("close");
        };
        return DetailsViewModel;
    })();
    return DetailsViewModel;
});
