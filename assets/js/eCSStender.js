/*------------------------------------------------------------------------------
Function:       eCSStender()
Author:         Aaron Gustafson (aaron at easy-designs dot net)
Creation Date:  2006-12-03
Version:        0.10.1
Homepage:       http://eCSStender.org
License:        MIT License (see homepage)
Note:           If you change or improve on this script, please let us know by
                emailing the author (above) with a link to your demo page.
------------------------------------------------------------------------------*/

(function(){
  
  var
  __eCSStensions  = [], // eCSStensions for parsing
  __stylesheets   = [], // stylesheets to parse
  __style_objects = {}, // style rules to track
  __xhr           = null,
  __initialized   = false,
  __ignored_props = ['selector','specificity'],
  __location      = window.location.href.replace( /^\w+:\/\/\/?(.*?)\/.*/, '$1' ),
  
  // for embedding stylesheets
  __head         = false,
  __style        = false,
  __embedded_css = [],
  
  // cache
  __support_cache = {
    selector: {},
    property: {}
  },
  
  // eCSStender Object
  eCSStender = {
    name:    'eCSStender',
    version: '0.10.1',
    fonts:   [],
    pages:   {},
    filters: {}
  };
  
  // window object
  window.eCSStender = eCSStender;

  /*------------------------------------*
   * Private Methods                    *
   *------------------------------------*/
  function initialize()
  {
    if ( __initialized == true ){ return; }
    __initialized = true;
  
    // need the head
    __head = document.getElementsByTagName( 'head' )[0];
    // need reusable style element
    __style = document.createElement( 'style' );
    __style.setAttribute( 'type', 'text/css' );
    
    getActiveStylesheets();
    parseStyles();
    runTests();
    eCSStend();
  }
  function getActiveStylesheets()
  {
    var stylesheets = document.styleSheets, s, sLen;
    for ( s=0, sLen=stylesheets.length; s<sLen; s++ )
    {
      // add the stylesheet
      addStyleSheet( stylesheets[s] );
    }
  }
  function findImportedStylesheets( stylesheet )
  {
    var blocks, i, iLen;
    // IE
    if ( typeof( stylesheet.imports ) != 'undefined' )
    {
      for ( i=0, iLen=stylesheet.imports.length; i<iLen; i++ )
      {
        // add the stylesheet
        addStyleSheet( stylesheet.imports[i] );
      }
    }
    // W3C
    else
    {
      blocks = stylesheet.cssRules || stylesheet.rules;
      for ( i=0, iLen=blocks.length; i<iLen; i++ )
      {
        // imports must come first, so when we don't find one, return
        if ( blocks[i].type != '3' ){ return; }
        
        // add the stylesheet
        addStyleSheet( blocks[i].styleSheet );
      }
    }
  }
  function addStyleSheet( stylesheet )
  {
    // skip if disabled or foreign
    if ( stylesheet.disabled ||
         determinePath( stylesheet ).indexOf( __location ) == -1 ){ return; }
    // does it have imports?
    findImportedStylesheets( stylesheet );
    // push the current stylesheet to the collection
    __stylesheets.push( stylesheet );
  }
  function parseStyles()
  {
    var s, sLen, media, m, mLen, path, css;
    for ( s=0, sLen=__stylesheets.length; s<sLen; s++ )
    {
      // determine the media type
      media = determineMedia( __stylesheets[s] );
      media = media.split(/\s*,\s*/);
      createMediaContainers( media );
      // get the stylesheet contents via XHR as we can't safely procure them from cssRules
      path = determinePath( __stylesheets[s] );
      css = clean( path != null ? get( path ) : extract( __stylesheets[s] ) );
      // extract @font-face
      css = extractFonts( css );
      // extract @page
      css = extractPages( css );
      // handle @media
      css = handleMediaGroups( css );
      // handle remaining rules
      extractStyleBlocks( media, css );
    }
  }
  function extractFonts( css )
  {
    var match, regex = /@font-face\s*?{(.*?)\s*?}/ig;
    while ( ( match = regex.exec( css ) ) != null )
    {
      eCSStender.fonts.push( gatherProperties( match[1] ) );
    }
    return css.replace( regex, '' );
  }
  function extractPages( css )
  {
    var match, page, regex = /@page\s*?(:\w*?){0,1}{\s*?(.*?)\s*?}/ig;
    while ( ( match = regex.exec( css ) ) != null )
    {
      page = ( typeof( match[1] ) != 'undefined' &&
               match[1] != '' ) ? match[1].replace(':','')
                                : 'all';
      eCSStender.pages[page] = gatherProperties( match[2] );
    }
    return css.replace( regex, '' );
  }
  function handleMediaGroups( css )
  {
    var match, media, m, mLen, styles, regex = /@media\s*(.*?)\s*{(.*)}\s*}/ig;
    while ( ( match = regex.exec( css ) ) != null )
    {
      media  = match[1].split(/\s*,\s*/);
      styles = match[2];
      createMediaContainers( media );
      extractStyleBlocks( media, styles );
    }
    return css.replace( regex, '' );
  }
  function extractStyleBlocks( media, css )
  {
    // parse it into blocks & remove the last item (which is empty)
    var blocks = css.split('}'), b, bLen, props, prop, selector, medium, arr, a, aLen;
    blocks.pop();
    // loop
    for ( b=0, bLen=blocks.length; b<bLen; b++ )
    {
      // separate the selector and the properties
      blocks[b] = blocks[b].split('{');
      // gather the properties
      props = gatherProperties( blocks[b][1] );
      // build the selectors (which are part of the master object)
      selector = blocks[b][0];
      // single selector
      if ( selector.indexOf(',') == -1 )
      {
        selector = trim( selector );
        for ( medium in media )
        {
           // fix for tainted Object
          if ( isInheritedProperty( media, medium ) ) { continue; }
          // continue
          if ( typeof( __style_objects[media[medium]][selector] ) == 'undefined' )
          {
            __style_objects[media[medium]][selector] = {};
          }
          for ( prop in props )
          {
            // fix for tainted Object
            if ( isInheritedProperty( props, prop ) ) { continue; }
            __style_objects[media[medium]][selector][prop] = props[prop];
          }
        }
      }
      // compound selector
      else
      {
        arr = selector.split( /\s*,\s*/ );
        for ( a=0, aLen=arr.length; a<aLen; a++ )
        {
          selector = trim( arr[a] );
          for ( medium in media )
          {
            // fix for tainted Object
            if ( isInheritedProperty( media, medium ) ) { continue; }
            // continue
            if ( typeof( __style_objects[media[medium]][selector] ) == 'undefined' )
            {
              __style_objects[media[medium]][selector] = {};
            }
            for ( prop in props )
            {
              // fix for tainted Object
              if ( isInheritedProperty( props, prop ) ) { continue; }
              // continue
              __style_objects[media[medium]][selector][prop] = props[prop];
            }
          }
        }
      }
    }
  }
  function gatherProperties( properties )
  {
    properties = properties.split(';');
    var props = {}, p, pLen, arr, property;
    for ( p=0, pLen=properties.length; p<pLen; p++ )
    {
      property = trim( properties[p] );
      // skip empties
      if ( property == '' ){ continue; }
      arr = property.split( /:(?!\/\/)/ );
      props[trim(arr[0])] = trim( arr[1] );
    }
    return props;
  }
  function runTests()
  {
    var temp = [], e, eLen;
    for ( e=0, eLen=__eCSStensions.length; e<eLen; e++ )
    {
      // verify test (if any)
      if ( typeof( __eCSStensions[e]['test'] ) == 'undefined' ||
           ( typeof( __eCSStensions[e]['test'] ) != 'undefined' &&
             __eCSStensions[e]['test']() == true ) )
      {
        // if no test or test is passed, push to the temp array
        temp.push( __eCSStensions[e] );
      }
    }
    // reset the __eCSStensions array
    __eCSStensions = temp;
  }
  function eCSStend()
  {
    // see if there's anything to do
    if ( __eCSStensions.length < 1 ){ return; }
    // parse by medium
    var
    medium, styles, s, sLen, selector, eLoop, e, eLen, eMedia, lookups, l, lLen, temp, t, lookup, property;
    for ( medium in __style_objects )
    {
      // safety for users who are using Prototype or any code that extends Object
      if ( isInheritedProperty( __style_objects, medium ) ) { continue; }
      // start the processing in earnest      
      styles = getSortedArray( __style_objects[medium] );
      for ( s=0, sLen=styles.length; s<sLen; s++ )
      {
        selector = styles[s]['selector'];
        // loop the extensions
        eLoop:
        for ( e=0, eLen=__eCSStensions.length; e<eLen; e++ )
        {
          // verify any media restrictions
          if ( typeof( __eCSStensions[e]['media'] ) != 'undefined' &&
               __eCSStensions[e]['media'] != 'all' )
          {
            eMedia = __eCSStensions[e]['media'].split(/,\s*?/);
            if ( medium != 'all' &&
                 ! in_object( medium, eMedia ) ){
              continue;
            }
          }
          // eCSStension is triggered by a selector 
          if ( __eCSStensions[e]['find_by'] == 'selector' )
          {
            for ( l=0, lLen=__eCSStensions[e]['lookup'].length; l<lLen; l++ )
            {
              if ( selectorMatches( selector, __eCSStensions[e]['lookup'][l] ) )
              {
                triggerCallback( e, medium, selector );
                continue eLoop;
              }
            }
          }
          // eCSStension uses a property
          else if ( __eCSStensions[e]['find_by'] == 'property' )
          {
            for ( l=0, lLen=__eCSStensions[e]['lookup'].length; l<lLen; l++ )
            {
              if ( typeof( __style_objects[medium][selector][__eCSStensions[e]['lookup'][l]] ) != 'undefined' )
              {
                triggerCallback( e, medium, selector );
                continue eLoop;
              }
            }
          }
          // eCSStension uses a fragment or prefix
          else if ( __eCSStensions[e]['find_by'] == 'fragment' ||
                    __eCSStensions[e]['find_by'] == 'prefix' )
          {
            lookup = ( __eCSStensions[e]['find_by'] == 'fragment' ) ? '.*?' + __eCSStensions[e]['lookup'] + '.*?'
                                                                    : '-' + __eCSStensions[e]['lookup'] + '-.*';
            lookup = new RegExp( lookup );
            for ( property in __style_objects[medium][selector] )
            {
              if ( ! isInheritedProperty( __style_objects[medium], selector ) && // fix for tainted Object
                   ! in_object( property, __ignored_props ) &&
                   property.match( lookup ) )
              {
                triggerCallback( e, medium, selector );
                continue eLoop;
              }
            }
          } // end if eCSStension uses a fragment or prefix
        } // end eCSStensions loop
      } // end styles loop
    } // end medium loop
  }
  // callback functionality
  function triggerCallback( eCSStension_id, medium, selector )
  {
    if ( in_object( medium + '-' + selector, __eCSStensions[eCSStension_id]['processed'] ) ) { return; }
    // apply any filters
    if ( typeof( __eCSStensions[eCSStension_id]['filter'] ) != 'undefined' )
    {
      if ( ! filtersMatched( __style_objects[medium][selector], __eCSStensions[eCSStension_id]['filter'] ) ){
        return;
      }
    }
    var properties = extractProperties( medium, selector, __eCSStensions[eCSStension_id]['properties'] );
    __eCSStensions[eCSStension_id]['callback']( selector, properties, medium, __style_objects[medium][selector]['specificity'] );
    __eCSStensions[eCSStension_id]['processed'].push( medium + '-' + selector );
  }
  // filtering on properties & values
  function filtersMatched( properties, filters )
  {
    var count, required_count, prop, filter;
    for ( prop in properties )
    {
      if ( isInheritedProperty( properties, prop ) ||
           in_object( prop, __ignored_props ) ){ continue; }
      count = required_count = 0;
      for ( filter in filters )
      {
        if ( isInheritedProperty( filters, filter ) ){ continue; }
        required_count++;
        if ( filter == 'property' )
        {
          if ( prop.match( filters[filter] ) ){ count++; }
        }
        else if ( filter == 'value' )
        {
          if ( properties[prop].match( filters[filter] ) ){ count++; }
        }
      }
      if ( count == required_count ){ return true; }
    }
    return false;
  }

  /*------------------------------------*
   * Private Utils                      *
   *------------------------------------*/
  function getSortedArray( styles )
  {
    var arr = [], temp, selector;
    for ( selector in styles )
    {
      // fix for tainated Object
      if ( isInheritedProperty( styles, selector ) ) { continue; }
      // continue
      temp = styles[selector];
      temp['selector']    = selector;
      temp['specificity'] = getSpecificity( selector );
      arr.push( temp );
    }
    arr.sort( sortBySpecificity );
    return arr;
  }
  function sortBySpecificity( a, b )
  {
    var x = a['specificity'], y = b['specificity'];
    return ( ( x < y ) ? -1 : ( ( x > y ) ? 1 : 0 ) );
  }
  function getSpecificity( selector )
  {
    var s = 0, matches;
    // replace all child and adjascent sibling selectors
    selector = selector.replace( /\s*\+\s*|\s*\>\s*/, ' ' );
    // adjust :not() to simplify calculations (since it counts toward specificity, as do its contents)
    selector = selector.replace( /(:not)\((.*)\)/, '$1 $2' );
    // match id selectors (weight: 100)
    matches = selector.match( /#/ );
    if ( matches != null ) s += ( matches.length * 100 );
    selector = selector.replace( /#[\w-_]+/, '' ); // remove (to keep the regexs simple)
    // match class, pseudo-class, and attribute selectors (weight: 10)
    matches = selector.match( /::|:|\.|\[.*?\]/ );
    if ( matches != null ) s += ( matches.length * 10 );
    selector = selector.replace( /(?:::|:|\.)[\w-_()]+|\[.*?\]/, '' ); // remove
    // match element selectors (weight: 1) - they should be all that's left
    matches = trim( selector ) != '' ? selector.split(' ') : [];
    s += matches.length;
    return s;
  }
  function determinePath( stylesheet )
  {
    var
    css_path = stylesheet.href, curr_path, file_name, parent = null, parent_path = prefix = '';
    // we only want paths that
    if ( css_path != null &&                         // are not null
         css_path.indexOf('/') != 0 &&               // don't start with a slash
         ( css_path.match( /\w+?\:\/\// ) == null || // that are not fully-qualified files
           css_path.match( /\w+?\:\/\// ) < 1 ) )
    {
      curr_path = window.location.href.substring( 0, window.location.href.lastIndexOf('/') );
      file_name = css_path.substring( css_path.lastIndexOf('/') + 1 );
      // check for an owner
      if ( stylesheet.parentStyleSheet == null )
      {
        if ( typeof( CSSImportRule ) != 'undefined' &&
             stylesheet.ownerRule instanceof CSSImportRule )
        {
          parent = stylesheet.ownerRule.parentStyleSheet;
        }
      }
      else
      {
        parent = stylesheet.parentStyleSheet;
      }
      // no parent, use the css path itself
      if ( parent == null )
      {
        prefix = curr_path + '/' + css_path.substring( 0, css_path.lastIndexOf('/') );
      }
      // get the owner's path
      else
      {
        parent_path = determinePath( parent );
        prefix      = parent_path.substring( 0, parent_path.lastIndexOf('/') );
      }
      css_path = prefix + '/' + file_name;
    }
    return css_path;
  }
  function determineMedia( stylesheet )
  {
    // W3C compliant
    if ( typeof( stylesheet.media ) != 'string' )
    {
      // imported
      if ( stylesheet.ownerRule != null )
      {
        // media assignment in the import
        if ( stylesheet.ownerRule.media.mediaText != '' )
        {
          return stylesheet.ownerRule.media.mediaText;
        }
        // no media assignment... inherit
        else
        {
          return determineMedia( stylesheet.ownerRule.parentStyleSheet );
        }
      }
      // media is defined
      if ( stylesheet.media.mediaText != '' )
      {
        return stylesheet.media.mediaText;
      }
    }
    // old school
    else if ( typeof( stylesheet.media ) == 'string' &&
              stylesheet.media != '')
    {
      return stylesheet.media;
    }
    // default = all
    return 'all';
  }
  function determineProperties( lookup, requested_properties )
  {
    var properties = [], i, iLen;
    // properties is set
    if ( requested_properties !== false )
    {
      // user doesn't want everything
      if ( requested_properties != '*' )
      {
        // gather requested properties
        if ( typeof( requested_properties ) == 'string' )
        {
          properties.push( requested_properties );
        }
        else if ( requested_properties instanceof Array )
        {
          for ( i=0, iLen=requested_properties.length; i<iLen; i++ )
          {
            properties.push( requested_properties[i] );
          }
        }
      }
      else
      {
        properties = requested_properties;
      }
    }
    // now for the remainder
    if ( requested_properties != '*' )
    {
      // retrieve properties that were explicitly looked up
      if ( typeof( lookup['property'] ) != 'undefined' )
      {
        if ( typeof( lookup['property'] ) == 'string' )
        {
          properties.push( lookup['property'] );
        }
        else if ( lookup['property'] instanceof Array )
        {
          for ( i=0; i<lookup['property'].length; i++ )
          {
            properties.push( lookup['property'][i] );
          }
        }
      }
      // retrieve fragment matches
      else if ( typeof( lookup['fragment'] ) != 'undefined' )
      {
        properties.push( new RegExp( '.*?' + lookup['fragment'] + '.*?' ) );
      }
      // retrieve prefix matches
      else if ( typeof( lookup['prefix'] ) != 'undefined' )
      {
        properties.push( new RegExp( '-' + lookup['prefix'] + '-.*' ) );
      }
    }
    return properties;
  }
  function extractProperties( medium, selector, requested_properties )
  {
    var requested_property, property, properties = {}, p, pLen;
    // grab the requested properties
    if ( requested_properties instanceof Array )
    {
      for ( p=0, pLen=requested_properties.length; p<pLen; p++ )
      {
        requested_property = requested_properties[p];
        if ( requested_property instanceof RegExp )
        {
          for ( property in __style_objects[medium][selector] )
          {
            if ( ! isInheritedProperty( __style_objects[medium][selector], property ) && // fix for tainted Object
                 ! in_object( property, __ignored_props ) &&
                 property.match( requested_property ) != null )
            {
              properties[property] = __style_objects[medium][selector][property];
            }
          }
        }
        else if ( typeof( requested_property ) == 'string' &&
                  typeof( __style_objects[medium][selector][requested_property] ) != 'undefined' )
        {
          properties[requested_property] = __style_objects[medium][selector][requested_property];
        }
      }
    }
    // all properties (*)
    else
    {
      for ( property in __style_objects[medium][selector] )
      {
        if ( ! isInheritedProperty( __style_objects[medium][selector], property ) &&
             ! in_object( property, __ignored_props ) )
        {
          properties[property] = __style_objects[medium][selector][property];
        }
      }
    }
    return properties;
  }
  function arrayify( something )
  {
    var arr=[], i, iLen, temp, t, tLen;
    if ( ! ( something instanceof Array ) )
    {
      if ( typeof( something ) == 'string' &&
           something.indexOf(',') != -1 )
      {
        temp = something.split( /\s*,\s*/ );
        for ( i=0, iLen=temp.length; i<iLen; i++ )
        {
          arr.push( temp[i] );
        }
      }
      else
      {
        arr = [ something ];
      }
    }
    else
    {
      for ( i=0, iLen=something.length; i<iLen; i++ )
      {
        if ( typeof( something[i] ) == 'string' &&
            something[i].indexOf(',') != -1 )
        {
          temp = something[i].split( /\s*,\s*/ );
          for ( t=0, tLen=temp.length; t<tLen; t++ )
          {
            arr.push( temp[t] );
          }
        }
        else
        {
          arr.push( something[i] );
        }
      }
    }
    return arr;
  }
  function createMediaContainers( media )
  {
    if ( ! ( media instanceof Array ) )
    {
      media = media.split(/\s*,\s*/);
    }
    for ( var m=0, mLen=media.length; m<mLen; m++ )
    {
      if ( typeof( __style_objects[media[m]] ) == 'undefined' )
      {
        __style_objects[media[m]] = {};
      }
    }
  }
  function selectorMatches( selector, test )
  {
    var useless = /\*(?!\s|>|\+)/g;
    return ( ( test instanceof RegExp &&
               selector.match( test ) != null ) ||
             ( test instanceof Function &&
               test.call( selector ) === true ) ||
             ( typeof( test ) == 'string' &&
               selector.indexOf( trim( test.replace( useless, '' ) ) ) != -1 ) );
  }
  function clean( css )
  {
    css = css.replace( /\s*(?:\<\!--|--\>)\s*/g, '' ) // strip HTML comments
             .replace( /\/\*(?:.|\s)*?\*\//g, '' )    // strip CSS comments
             .replace( /\s*([,{}:;])\s*/g, '$1' )     // remove returns and indenting whitespace
             .replace( /@import.*?;/g, '' );         // axe imports
    return css;
  }
  function in_object( needle, haystack )
  {
    for ( var key in haystack )
    {
      if ( haystack[key] == needle ){ return true; }
    }
    return false;
  }
  function get( uri )
  {
    if ( uri == null ) return '';
    if ( __xhr == null ){ __xhr = new XHR(); }
    __xhr.open( 'GET', uri, false );
    __xhr.send( null );
    return __xhr.responseText;
  }
  function extract( stylesheet )
  {
    return stylesheet.ownerNode.innerHTML;
  }
  function camelize( str ){
    var
    bits = str.split('-'), len  = bits.length, new_str, i = 1;
    if ( len == 1 ) { return bits[0]; } 
    if ( str.charAt(0) == '-' ) {
      new_str = bits[0].charAt(0).toUpperCase() + bits[0].substring(1);
    } else {
      new_str = bits[0];
    }
    while ( i < len ) {
      new_str += bits[i].charAt(0).toUpperCase() + bits[i].substring(1);
      i++;
    }
    return new_str;
  }
  function zero_out( str )
  {
    if ( typeof( str ) == 'string' )
    {
      str = str.replace( /(\s0)px/g, '$1' );
    }
    return str;
  }
  function addInlineStyle( el, property, value )
  {
    try {
      el.style[property] = value;
      el.style[camelize( property )] = value;
    } catch( e ){
      return false;
    }
    return true;
  }
  function XHR()
  {
    var connection;
    try { connection = new XMLHttpRequest(); }
    catch( e ){
      try { connection = new ActiveXObject('Msxml2.XMLHTTP'); }
      catch( e ){
        try { connection = new ActiveXObject('Microsoft.XMLHTTP'); }
        catch( e ){
          connection = false;
        }
      }
    }
    return ( ! connection ) ? null : connection;
  }
  function cacheResult( cache, key, value )
  {
    key = key.replace( /[:()]/g, '_' );
    cache[key] = value;
  }
  function readCachedResult( cache, key )
  {
    key = key.replace( /[:()]/g, '_' );
    return ( typeof( cache[key] ) != 'undefined' ) ? cache[key] : 'undefined';
  }
  if ( Array.prototype.push == null )
  {
    var push = function( obj )
    {
      this[this.length] = obj;
      return this.length;
    };
    eCSStender.fonts.push = __eCSStensions.push = __stylesheets.push = __embedded_css.push = push;
  }


  /*-------------------------------------*
   * Public Methods                      *
   *-------------------------------------*/
  /**
   * eCSStender::register()
   * registers an extension
   *
   * @param obj keys - define the lookup; supports the following properties:
   *  * Mutually exclusive lookup methods:
   *    * 'fragment' (str) - a portion of the property to look up
   *    * 'prefix' (str) - to lookup by vendor-specific prefix
   *    * 'property' (mixed)
   *      * to lookup by property, use a string
   *      * to lookup by multiple, use an array of strings
   *    * 'selector' (mixed) - to find by selector; accepts
   *      * compound selectors in a string, separated by commas
   *      * a RegExp to match
   *      * an array of selector strings or RegExp objects to match
   *  * 'filter' (obj) - allows you to filter the lookup results by property name or value
   *    * 'property' (mixed) - string or regex to match for the extension to apply
   *    * 'value' (mixed) - string or regex to match for the extension to apply
   *  * 'media' (str) - restricts the media to which you want to
   *    restrict the extension
   *  * 'test' (fn) - a test function to run that will determine 
   *     whether or not the extension should run; should return 
   *     true if the extension SHOULD run, false if it SHOULD NOT.
   * @param mixed properties - the properties you want back; supports for:
   *  * false - returns only the looked-up property or properties with 
   *    the given fragment or prefix
   *  * '*' (str) - returns all properties of the selected elements
   *  * single property (str) - returns the supplied property
   *  * multiple properties (arr) - returns the requested properties
   * @param fn callback - the function to be called when the extension 
   *                      finds a subject
   */
  eCSStender.register = function( keys, properties, callback )
  {
    var eCSStension = {}, lookups, l, temp, t, props = [];
    // set the lookup type
    if ( typeof( keys['selector'] ) != 'undefined' )
    {
      eCSStension['find_by'] = 'selector';
      eCSStension['lookup']  = keys['selector'];
    }
    else if ( typeof( keys['property'] ) != 'undefined' )
    {
      eCSStension['find_by'] = 'property';
      eCSStension['lookup']  = keys['property'];
    }
    else if ( typeof( keys['fragment'] ) != 'undefined' )
    {
      eCSStension['find_by'] = 'fragment';
      eCSStension['lookup']  = keys['fragment'];
    }
    else if ( typeof( keys['prefix'] ) != 'undefined' )
    {
      eCSStension['find_by'] = 'prefix';
      eCSStension['lookup']  = keys['prefix'];
    }
  
    // convert some lookups to arrays to simplify things later on
    if ( eCSStension['find_by'] == 'selector' ||
         eCSStension['find_by'] == 'property' )
    {
      eCSStension['lookup'] = arrayify( eCSStension['lookup'] );
    }

    // filter?
    if ( typeof( keys['filter'] ) != 'undefined' )
    {
      eCSStension['filter'] = keys['filter'];
    }
  
    // media restriction?
    if ( typeof( keys['media'] ) != 'undefined' )
    {
      eCSStension['media'] = keys['media'];
    }
  
    // test first?
    if ( typeof( keys['test'] ) != 'undefined' )
    {
      eCSStension['test'] = keys['test'];
    }
  
    // set the properties to capture
    eCSStension['properties'] = determineProperties( keys, properties );
    
    // set the callback
    eCSStension['callback'] = callback;
    // create the processed array
    eCSStension['processed'] = [];
    // save the extension
    __eCSStensions.push( eCSStension );
  }

  /**
   * eCSStender::lookup()
   * looks up and returns styles based on the supplied info
   *
   * @param obj lookup - define the lookup; supports the following properties:
   *  * Mutually exclusive lookup methods:
   *    * 'fragment' (str) - a portion of the property to look up
   *    * 'prefix' (str) - to lookup by vendor-specific prefix
   *    * 'property' (mixed)
   *      * to lookup by property, use a string
   *      * to lookup by multiple, use an array of strings
   *    * 'selector' (mixed) - to find by selector; accepts
   *      * compound selectors in a string, separated by commas
   *      * a RegExp to match
   *      * an array of selector strings or RegExp objects to match
   *      * a function that returns true for a positive match
   *  * 'media' (str) - restricts the media within which you want to search
   *  * 'specificity' (mixed) - the desired specificity parameters
   *    * if an integer, implies maximum specificity
   *    * if an object, use keys to set the thresholds:
   *      * 'max' (int) - maximum specificity to match
   *      * 'min' (int) - minimum specificity to match
   * @param mixed properties - the properties you want back; support for:
   *  * false - returns only the looked-up property or properties with 
   *    the given fragment or prefix
   *  * '*' (str) - returns all properties of the selected elements
   *  * single property (str) - returns the supplied property
   *  * multiple properties (arr) - returns the requested properties
   * 
   * @return arr of style objects, each with the following keys:
   *  * 'medium'      - the medium of the match
   *  * 'properties'  - the properties requested
   *  * 'selector'    - the selector matched
   *  * 'specificity' - the specificity of the selector
   */
  eCSStender.lookup = function( lookup, properties )
  {
    var min, max, medium, eMedia, sLoop, styles, s, sLen, selector, found, i, iLen, test, matches = [];
    // figure out specificity params
    if ( typeof( lookup['specificity'] ) != 'undefined' )
    {
      if ( typeof( lookup['specificity'] ) == 'number' )
      {
        max = lookup['specificity'];
        min = 0;
      }
      else if ( typeof( lookup['specificity'] ) == 'object' )
      {
        max = lookup['specificity']['max'];
        min = lookup['specificity']['min'];
      }
    }
    // make the selector setup consistent
    if ( typeof( lookup['selector'] ) != 'undefined' )
    {
      lookup['selector'] = arrayify( lookup['selector'] );
    }
    else if ( typeof( lookup['property'] ) != 'undefined' )
    {
      lookup['property'] = arrayify( lookup['property'] );
    }
    // figure out properties to return
    props = determineProperties( lookup, properties );
    // loop
    for ( medium in __style_objects )
    {
      // safety for users who are using Prototype or any code that extends Object
      if ( isInheritedProperty( __style_objects, medium ) ){ continue; }
      // verify any media restrictions
      if ( typeof( lookup['media'] ) != 'undefined' &&
           lookup['media'] != 'all' )
      {
        eMedia = lookup['media'].split(/\s*,\s*/);
        if ( medium != 'all' &&
             ! in_object( medium, eMedia ) )
        {
          continue;
        }
      }
      // start the processing in earnest      
      styles = getSortedArray( __style_objects[medium] );
      sLoop:
      for ( s=0, sLen=styles.length; s<sLen; s++ )
      {
        // check the selector
        selector = styles[s]['selector'];
        if ( typeof( lookup['selector'] ) != 'undefined' )
        {
          found = false;
          for ( i=0, iLen=lookup['selector'].length; i<iLen; i++ )
          {
            if ( selectorMatches( selector, lookup['selector'][i] ) )
            {
              found = true;
              break;
            }
          }
          if ( found === false )
          {
            continue;
          }
        }
        // check properties
        else if ( typeof( lookup['property'] ) != 'undefined' )
        {
          found = false;
          for ( i=0, iLen=lookup['property'].length; i<iLen; i++ )
          {
            if ( typeof( __style_objects[medium][selector][lookup['property'][i]] ) != 'undefined' )
            {
              found = true;
              break;
            }
          }
          if ( found === false )
          {
            continue;
          }
        }
        // check fragments, and/or prefixes
        else if ( typeof( lookup['fragment'] ) != 'undefined' ||
                  typeof( lookup['prefix'] ) != 'undefined' )
        {
          found = false;
          test = ( typeof( lookup['fragment'] ) != 'undefined' ) ? '.*?' + lookup['fragment'] + '.*?'
                                                                 : '-' + lookup['prefix'] + '-.*';
          test = new RegExp( test );
          for ( property in __style_objects[medium][selector] )
          {
            if ( ! isInheritedProperty( __style_objects[medium], selector ) && // fix for tainted Object
                 ! in_object( property, __ignored_props ) &&
                 property.match( test ) )
            {
              found = true;
              break;
            }
          }
          if ( found === false )
          {
            continue;
          }
        }
        // check the specificity
        if ( typeof( lookup['specificity'] ) != 'undefined' )
        {
          if ( __style_objects[medium][selector]['specificity'] < min ||
               __style_objects[medium][selector]['specificity'] > max )
          {
            continue;
          }
        }
        // if you made it this far, you passed the tests
        matches.push({
          'medium':      medium,
          'properties':  extractProperties( medium, selector, props ),
          'selector':    selector,
          'specificity': __style_objects[medium][selector]['specificity']
        });
      } // end styles loop
    } // end medium loop
    
    // back what we found
    return matches;
    
  }

  /**
   * eCSStender::setFilter()
   * sets a JavaScript filter function in eCSStender's filter object
   *
   * @param str name - a name for the filter
   * @param func the_function - the function to store
   */
  eCSStender.setFilter = function( name, the_function )
  {
    eCSStender.filters[name] = the_function;
  }

  /**
   * eCSStender::embedCSS()
   * embeds styles to the appropriate media
   *
   * @param str styles - the styles to embed
   * @param str media  - the media to apply the stylesheet to (optional)
   * 
   * @return obj - the STYLE element
   */
  eCSStender.embedCSS = function( styles, media )
  {
    // determine the medium
    media = media || 'all';
    // determine the id
    var id = 'eCSStension-' + media, style;
    // find or create the embedded stylesheet
    if ( ! in_object( media, __embedded_css ) )
    {
      // make the new style element
      style = newStyleElement( media, id );
      // store the medium
      __embedded_css.push( media );
    }
    else
    {
      style = document.getElementById( id );
    }
    // add the rules to the sheet
    addRules( style, styles );   
    // return the id 
    return style;
  }

  /**
   * eCSStender::newStyleElement()
   * adds a new stylesheet to the document
   *
   * @param str media  - the media to apply the stylesheet to
   * @param str id     - the id to give the stylesheet (optional)
   * 
   * @return obj - the STYLE element
   */
  function newStyleElement( media, id )
  {
    // clone the model style element
    var style = __style.cloneNode( true );
    // set the media type & id
    media = media || 'all';
    style.setAttribute( 'media', media );
    id = id || 'temp-' + Math.round( Math.random() * 2 + 1 );
    style.setAttribute( 'id', id );
    // append to the head
    __head.appendChild( style );
    // return the element reference
    return style;
  }
  eCSStender.newStyleElement = newStyleElement;

  /**
   * eCSStender::addRules()
   * adds rules to a specific stylesheet
   *
   * @param obj el     - the stylesheet
   * @param str styles - the style rules to add
   */
  function addRules( el, styles )
  {
    if ( typeof( el.sheet ) != 'undefined' &&
         typeof( CSSStyleSheet ) != 'undefined' &&
         el.sheet instanceof CSSStyleSheet )
    {
      if ( typeof( el.sheet.insertRule ) == 'function' )
      {
        el.sheet.insertRule( styles, el.sheet.cssRules.length );
      }
      else
      {
        var blocks = styles.split('}'), b, bLen;
        blocks.pop();
        for ( b=0, bLen=blocks.length; b<bLen; b++ )
        {
          blocks[b] = blocks[b].split('{');
          el.sheet.addRule( trim( blocks[b][0] ), trim( blocks[b][1] ) );
        }
      }
    }
    else if ( typeof( el.styleSheet ) != 'undefined' )
    { 
      el.styleSheet.cssText = styles;
    }
    else
    { 
      el.appendChild( document.createTextNode( styles ) ); 
    }
  }
  eCSStender.addRules = addRules;

  /**
   * eCSStender::isSupported()
   * tests support for properties and selectors
   *
   * @param str type - 'property' or 'selector'
   * @param str what - the property:value pair or the selector in question
   * @param obj html - the HTML to test against (used by selector test)
   * @param obj el   - the element the selector should select (used by selector test)
   * 
   * @return bool - true for success, false for failure
   */
  eCSStender.isSupported = function( type, what, html, el )
  {
    var result;
    if ( ( result = readCachedResult( __support_cache[type], what ) ) != 'undefined' )
    {
      return result;
    }
    else
    {
      //alert( 'checking the result' );
      result = false;
      var
      // property test vars
      property, value, expando = true, settable = true,
      // selector test vars
      style;
      if ( type == 'property' )
      {
        // test element
        el = document.createElement('div');
        document.body.appendChild( el );
        what = what.split( /:(?!\/\/)/ );
        property  = what[0];
        value     = trim( what[1] );
        what = what.join(':');
        if ( typeof( document.expando ) != 'undefined' )
        {
          expando = document.expando;
          document.expando = false;
        }
        if ( !addInlineStyle( el, property, value ) )
        {
          settable = false;
        }
        if ( typeof( document.expando ) != 'undefined' )
        {
          document.expando = expando;
        }
        if ( settable == true &&
             ( el.currentStyle &&
               zero_out( el.currentStyle[camelize( property )] ) == value ) ||
             ( window.getComputedStyle &&
               zero_out( window.getComputedStyle( el, null ).getPropertyValue( property ) ) == value ) )
        {
          result = true;
        }
        // cleanup
        document.body.removeChild( el );
        el = null;
      }
      else if ( type == 'selector' )
      {
        // append the test markup and the test style element
        document.body.appendChild( html );
        style = newStyleElement( 'screen' );
        // if the browser doesn't support the selector, it should error out
        try {
          addRules( style, what + " { visibility: hidden; }" );
          // if it succeeds, we don't want to run the eCSStension
          if ( ( el.currentStyle &&
                 el.currentStyle['visibility'] == 'hidden' ) ||
               ( window.getComputedStyle &&
                 window.getComputedStyle( el, null ).getPropertyValue( 'visibility' ) == 'hidden' ) )
          {
            result = true;
          }
        } catch( e ){}
        // cleanup
        document.body.removeChild( html );
        style.parentNode.removeChild( style );
        style = null;
      }
      cacheResult( __support_cache[type], what, result );
      return result;
    }
  }

  /**
   * eCSStender::applyWeightedStyle()
   * apply a weighted inline style (based on specificity)
   *
   * @param obj el - the element to apply the property to
   * @param obj properties - a hash of the properties to assign
   * @param int specificity - the specificity of the selector
   */
  eCSStender.applyWeightedStyle = function( el, properties, specificity )
  {
    var prop, cProp;
    if ( typeof( el.inlineStyles ) == 'undefined' )
    {
      el.inlineStyles = {};
    }
    for ( prop in properties )
    {
      if ( !isInheritedProperty( properties, prop ) &&
           ( typeof( el.inlineStyles[prop] ) == 'undefined' ||
             el.inlineStyles[prop] <= specificity ) )
      {
        addInlineStyle( el, prop, properties[prop] );
        el.inlineStyles[prop] = specificity;
      }
    }
  }

  /**
   * eCSStender::trim()
   * trims a string
   *
   * @param str str - the string to trim
   * 
   * @return str - the trimmed string
   */
  function trim( str )
  {
    return str.replace( /^\s+|\s+$/g, '' );
  }
  eCSStender.trim = trim;

  /**
   * eCSStender::isInheritedProperty()
   * tests whether the given property is inherited
   *
   * @param obj obj - the object to test
   * @param str prop - the property to look for
   * 
   * @return bool - true is property is inherited, false is it isn't
   */
  function isInheritedProperty( obj, prop )
  {
    var c = obj.constructor;
    if ( c &&
         c.prototype )
    { 
      return obj[prop] === c.prototype[prop];
    } 
    return true;
  }
  eCSStender.isInheritedProperty = isInheritedProperty;



  /*-------------------------------------*
   * DOM Loaded Trigger                  *
   * Based on the work of Jesse Skinner, *
   * Dean Edwards, Matthias Miller,      *
   * John Resig, and Dan Webb            *
   *-------------------------------------*/
  var __load_timer = false, __old_onload;
  // for Mozilla/Opera9
  if ( document.addEventListener ){
    document.addEventListener( 'DOMContentLoaded', function(){
      document.removeEventListener( "DOMContentLoaded", arguments.callee, false );
      initialize();
    }, false );
  }
  // for Internet Explorer
  /*@cc_on @*/
  /*@if (@_win32)
    document.write("<script id=__ie_onload defer src=//0><\/scr"+"ipt>");
    script = document.getElementById("__ie_onload");
    script.onreadystatechange = function() {
      if (this.readyState == "complete"){ initialize(); } // call the onload handler
    };
  /*@end @*/
  // for Safari
  if ( /WebKit/i.test( navigator.userAgent ) ) // sniff
  {
    __load_timer = setInterval( function(){
      if ( /loaded|complete/.test( document.readyState ) )
      {
        clearInterval( __load_timer );
        initialize();
      }
    }, 10 );
  }
  // for other browsers set the window.onload, but also execute the old window.onload
  __old_onload = window.onload;
  window.onload = function(){
    initialize();
    if ( __old_onload ){ old_onload(); }
  };
  
})();