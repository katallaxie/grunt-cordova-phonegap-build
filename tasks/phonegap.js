// syntax
'use strict';

// module
module.exports = ( grunt ) => {
// modules
const Path = require( 'path' );
const Fs = require( 'fs' );
const Async = require( 'async' );
const Progress = require( 'progress' );
const Client = require( 'phonegap-build-api' );
const Xml2js = require( 'xml2js' );
const Promise = require( 'promise' );

// map
const Log = grunt.log;
const Util = grunt.util;

// run the queue
// function run( tasks, done ) {
//   // inform
//   log.ok( 'Processing ....' );
//   // progress
//   // progress bar
//   bar = new Progress( '[:bar] :current/:total :elapsed', {
//     total: tasks.length,
//     width: 20
//   } );
//   // run the tasks
//   async.parallel( tasks, ( error ) => {
//     // error
//     if ( error ) {
//       throw new util.error( `Error-> Processing icons` );
//     }
//     // inform
//     log.ok( 'Done.' );
//     // nothing else to do
//     done( true );
//   } );
// }

// register as multi task to have multiple targets running
grunt.registerMultiTask( 'phonegap', 'Uploads and builds an app on PhoneGap Build', function () {
    // console.log(this);
    let done = this.async(),
      src = this.files[ 0 ].src[ 0 ],
      dest = this.files[ 0 ].dest,
      timeout,
      elapse;

    // merging task-specific and/or target-specific options witht the defaults
    let options = this.options( {
      // some defaults
      timeout : 60 * 1000 * 10,
      poll : 30 * 1000,
      platforms: [ 'ios', 'android' ],
      files: {
        android : 'android.apk',
        ios : 'ios.ipa'
      }
    } );

    let error = _error => {
      // log failure
      Log.fail( _error );
      // end task
      done();
    };

    // check for authentication, and config
    if ( !options.auth || !options.config || !src ) {
      // if there are no credentials provided
      done();
    }

    // constructing a parser
    const parser = new Xml2js.Parser();

    // reading in sync; because, you know, that's the way ;)
    let config = Fs.readFileSync( options.config );

    // parsing config
    parser.parseString( config, ( _error, result ) => {
      if ( _error ) {
        error( _error );
      }
      config = result; // hijacking
    } );

    // wrap to promise
    let client = Promise.denodeify( Client.auth );

    // get apps anyway
    let apps = function ( api ) {
      // map api to client
      client = api;
      return new Promise( function ( resolve, reject ) {
        client.get( '/apps', function ( _error, _data ) {
          if ( _error ) {
            reject( _error );
          } else {
            // looking for existing app
            _data = _data.apps.find( app => {
              return app.id === options.id || app.package === config.widget[ '$' ].id
            } );
            resolve( _data );
          }
        } );
      } );
    };

    // decide if a new app is to be created
    let create = function ( data ) {
      // so, if there is no id provided
      if ( !data ) {
        return new Promise( function ( resolve, reject ) {
          // debug
          Log.writeln( `Creating new app ... ` );
          // execute client
          client.post( '/apps', {
            form: {
              data: {
                title: options.title || config.widget[ '$' ].id,
                create_method : 'file'
              },
              file: src
            }
          }, function ( _error, _data ) {
            if ( _error ) {
              reject( _error );
            } else {
              Log.ok( `Created new app with App Id: ${ _data.id } `)
              // use the returned new app
              resolve( Object.assign( {}, _data, {} ) );
            }
          } );
        } );
      }
      return data;
    };

    // upload
    let upload = function ( data ) {
      if ( !!data.build_count && data.id ) {
        return new Promise( function ( resolve, reject ) {
          // debug
          Log.writeln( `Uploading new version ...` );
          // execute client
          client.put( `/apps/${ data.id }`, {
            form: {
              data: {
                platforms: options.platforms
              }
            },
            file: src
          }, function ( _error, _data ) {
            if ( _error ) {
              reject( _error );
            } else {
              resolve( _data );
            }
          } );
        } );
      }
      return data;
    };

    let check = function( id, platforms, success, time ) {
      if ( new Date().getTime() - elapse > options.timeout ) {
        time( `Timeout after ${ options.timeout / ( 1000 * 60) } minutes!` );
      }
      Log.writeln( `Polling builds for ${ options.platforms.join(', ') }...` );
      client.get( `/apps/${id}`, function( _error, _data ) {
        if ( _error ) {
          time( `Error in polling the builds!` );
        } else {
          clearTimeout( timeout );
          let downloads = 0;
          let pending = 0;
          options.platforms.forEach( platform => {
            pending += _data.status[ platform ] === 'pending';
            downloads += _data.status[ platform ] === 'complete';
            if ( _data.status[ platform ] === 'error' ) {
              Log.fail( `Error in ${ platform } build!` );
            }
          } );
          if ( pending === 0 ) {
            if ( downloads > 0 ) {
              success( _data );
            } else {
              error( `All builds seem to have failed!` );
            }
          } else {
            timeout = setTimeout( () => { check( id, platforms, success, time ); }, options.poll );
          }
        }
      } );
    };

    let poll = function( data ) {
      // save start time
      elapse = new Date().getTime();
      return new Promise( function ( resolve, reject ) {
        // this is the finish function
        let finish = _data => {
          resolve( _data );
        };
        let time = _error => {
          clearTimeout( timeout );
          reject( _error );
        };
        timeout = setTimeout( () => { check( data.id, options.platforms, finish, time ); }, options.poll );
      } );
    };

    // download
    let download = function( data ) {
      let promises = [];
      for ( let platform in data.download ) {
        if ( data.download.hasOwnProperty( platform ) && options.platforms.indexOf[ platform ] !== -1 ) {
          Log.writeln( `Downloading ${ platform } build ...` );
          promises.push( new Promise( function( resolve, reject ) {
            client.get( `/apps/${ data.id }/${ platform }`, function( _error, _data ) {
              if ( _error ) {
                Log.fail( `Error downloading ${ platform } build!` );
              }
              resolve( _data );
            } )
            .pipe( Fs.createWriteStream( Path.resolve( dest, options.files[ platform ] ) ) );
          } ) );
        }
      }
      return Promise.all( promises );
    };

    // success
    let success = function ( data ) {
      Log.ok( `Finish!` );
      done();
    };

    // flow
    client( options.auth )
      .then( apps )
      .then( create )
      .then( upload )
      .then( poll )
      .then( download )
      .then( success )
      .catch( error );
    } );

};
