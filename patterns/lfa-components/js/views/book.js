define([
  'jquery',
  'lettering',
  'underscore',
  'backbone',
  'store',
  'modernizr',
  'fastclick',
  'searchjson',
  
  'views/leftbar',
  'views/rightbar',
  'views/chapter',
  'views/menu'
], function($, Lettering, _, Backbone, Store, Modernizr, FastClick, SearchJSON, LeftbarView, RightbarView, ChapterView, MenuView) {
  'use strict';
  
  var Setting = Backbone.Model.extend({
    defaults: {
      title: '',
      value: false
    },
    
    toggle: function () {
      this.save({
        completed: !this.get('value')
      });
    }
  });
  
  var SettingsCollection = Backbone.Collection.extend({
    model: Setting,
    localStorage: new Store('lfa-settings')
  });
  
  var Settings = new SettingsCollection();
  // Fetch from localStorage.
  Settings.fetch();
  
  // Initialize settings if they don't exist.
  if (!Settings.findWhere({ title: 'Animations' })) {
    var animDefault = new Setting({ title: 'Animations', value: true });
    Settings.add(animDefault);
    animDefault.save();
  }
  
  var BookView = Backbone.View.extend({
    html: $('html'),
    
    initialize: function() {
      // Initialize FastClick. This removes the .3s delay in mobile webkit when clicking 
      // on anything.
      FastClick.attach(document.body);
      
      if (Settings.findWhere({ title: 'Animations' }).get('value')) {
        this.$el.addClass('animated');
      } else {
        this.$('#animations-toggle').addClass('active');
      }
      
      var self = this;
      // Close the sidebars when we tap anywhere on the textbook.
      this.$('section.container').on('click', function() {
        self.closeSidebars();
      });
      
      this.$('section.container').hammer().on('hold', function(event) {
        $(event.target).parent('section').children().lettering('words');
        console.log(event);
        var section = $(event.target).closest('section');
        var textbook = $('#textbook');
        
        var key = textbook.data('url') + '/' + section.index();
        console.log(SearchJSON.hashcodeIndex[key]);
      });
      
      this.leftbar = new LeftbarView({
        el: this.$('#leftbar'),
        parent: this,
        classActive: 'leftbar-active',
        closeGesture: 'dragleft'
      });
      
      this.rightbar = new RightbarView({
        el: this.$('#rightbar'),
        parent: this,
        classActive: 'rightbar-active',
        closeGesture: 'dragright'
      });
      
      this.chapter = new ChapterView({
        el: this.$('#textbook'),
        parent: this
      });
      
      this.menu = new MenuView({
        el: this.$('.menu'),
        parent: this
      });
    },
    
    showFirstChapter: function() {
      var firstChapterUrl = this.leftbar.$('ul li a[href]')[0].attributes.href.value;
      window.App.router.navigate(firstChapterUrl, true);
    },
    
    show: function(chapter) {
      // When navigating somewhere else in the toc,
      // scroll the user to the top of the page,
      window.scrollTo(0, 0);
      
      // close the sidebars if we're on a phone/portrait tablet,
      if ($(window).width() <= 768) {
        this.closeSidebars();
      }
      
      // remove the active class from the previous button and
      // add the active class to the one that was pressed.
      this.leftbar.makeActive(chapter);
      
      this.chapter.render(chapter);
    },
    
    closeSidebars: function() {
      this.leftbar.close();
      this.rightbar.close();
    },
    
    events: {
      'click #animations-toggle': function() {
        this.$el.toggleClass('animated');
        this.$('#animations-toggle').toggleClass('active');
        this.closeSidebars();
        Settings.findWhere({ title: 'Animations' }).set('value', this.$el.hasClass('animated')).save();
      }
    }
  });
  
  return BookView;
});