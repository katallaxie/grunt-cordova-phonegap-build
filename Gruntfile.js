/*
 * grunt-cordova-phonegap-build
 * https://github.com/katallaxie/grunt-cordova-phonegap-build
 *
 * Copyright (c) 2016 Sebastian Döll
 * Licensed under the MIT license
 */
// syntax
'use strict';

// module
module.exports = (grunt) => {
  // project configuration
  grunt.initConfig({
    phonegap : {
      all : {
        options : {
          // config
          config : 'config.xml',
          // if id is set, then upload, if not then create
          auth : {
            token : ''
            // or username, and password
          },
          // the platforms to build for
          platforms: ['ios', 'android'],
          // give it ten minutes
          timeout : 60 * 1000 * 10,
          // give it a minute
          poll : 60 * 1000
        },
        src : './tmp/phonegap.zip',
        dest : './tmp/'
      }
    },

    // checking code style
    eslint: {
      options: {
        format: 'stylish'
      },
      all: [
        'Gruntfile.js',
        'tasks/*.js'
      ]
    },
    // before testing anything, clear the relevant paths
    clean: {
      test: ['build']
    },

  });

  // load the plugin task
  grunt.loadTasks('tasks');

  // load development tasks
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-eslint');

  // when testing then first clean the relevant dirs and produce the icons
  grunt.registerTask('test', ['clean', 'phonegap']);
  // TODO: add unit tests

  // By default, lint and run all tests.
  grunt.registerTask('default', ['eslint', 'test']);

};
