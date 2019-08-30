/**
 * AJAX Request Queue
 *
 * - add()
 * - remove()
 * - run()
 * - stop()
 *
 * @since 1.0.0
 */
var AstraSitesAjaxQueue = (function() {

	var requests = [];

	return {

		/**
		 * Add AJAX request
		 *
		 * @since 1.0.0
		 */
		add:  function(opt) {
		    requests.push(opt);
		},

		/**
		 * Remove AJAX request
		 *
		 * @since 1.0.0
		 */
		remove:  function(opt) {
		    if( jQuery.inArray(opt, requests) > -1 )
		        requests.splice($.inArray(opt, requests), 1);
		},

		/**
		 * Run / Process AJAX request
		 *
		 * @since 1.0.0
		 */
		run: function() {
		    var self = this,
		        oriSuc;

		    if( requests.length ) {
		        oriSuc = requests[0].complete;

		        requests[0].complete = function() {
		             if( typeof(oriSuc) === 'function' ) oriSuc();
		             requests.shift();
		             self.run.apply(self, []);
		        };

		        jQuery.ajax(requests[0]);

		    } else {

		      self.tid = setTimeout(function() {
		         self.run.apply(self, []);
		      }, 1000);
		    }
		},

		/**
		 * Stop AJAX request
		 *
		 * @since 1.0.0
		 */
		stop:  function() {

		    requests = [];
		    clearTimeout(this.tid);
		}
	};

}());

(function($){

	/** Checking the element is in viewport? */
	$.fn.isInViewport = function() {

		// If not have the element then return false!
		if( ! $(this).length ) {
			return false;
		}

	    var elementTop = $(this).offset().top;
	    var elementBottom = elementTop + $(this).outerHeight();

	    var viewportTop = $(window).scrollTop();
	    var viewportBottom = viewportTop + $(window).height();

	    return elementBottom > viewportTop && elementTop < viewportBottom;
	};

	var AstraSSEImport = {
		complete: {
			posts: 0,
			media: 0,
			users: 0,
			comments: 0,
			terms: 0,
		},

		updateDelta: function (type, delta) {
			this.complete[ type ] += delta;

			var self = this;
			requestAnimationFrame(function () {
				self.render();
			});
		},
		updateProgress: function ( type, complete, total ) {
			var text = complete + '/' + total;

			if( 'undefined' !== type && 'undefined' !== text ) {
				total = parseInt( total, 10 );
				if ( 0 === total || isNaN( total ) ) {
					total = 1;
				}
				var percent = parseInt( complete, 10 ) / total;
				var progress     = Math.round( percent * 100 ) + '%';
				var progress_bar = percent * 100;

				if( progress_bar <= 100 ) {
					var process_bars = document.getElementsByClassName( 'astra-site-import-process' );
					for ( var i = 0; i < process_bars.length; i++ ) {
						process_bars[i].value = progress_bar;
					}
					AstraSitesAdmin._log_title( 'Importing Content.. ' + progress );
				}
			}
		},
		render: function () {
			var types = Object.keys( this.complete );
			var complete = 0;
			var total = 0;

			for (var i = types.length - 1; i >= 0; i--) {
				var type = types[i];
				this.updateProgress( type, this.complete[ type ], this.data.count[ type ] );

				complete += this.complete[ type ];
				total += this.data.count[ type ];
			}

			this.updateProgress( 'total', complete, total );
		}
	};

	AstraSitesAdmin = {

		_ref			: null,

		/**
		 * _api_params = {
		 * 		'search'                  : '',
		 * 		'per_page'                : '',
		 * 		'astra-site-category'     : '',
		 * 		'astra-site-page-builder' : '',
		 * 		'page'                    : '',
		 *   };
		 *
		 * E.g. per_page=<page-id>&astra-site-category=<category-ids>&astra-site-page-builder=<page-builder-ids>&page=<page>
		 */
		_api_params		: {},
		_breakpoint		: 768,
		_has_default_page_builder : false,
		_first_time_loaded : true,

		visited_sites_and_pages: [],

		reset_remaining_posts: 0,
		reset_remaining_wp_forms: 0,
		reset_remaining_terms: 0,
		reset_processed_posts: 0,
		reset_processed_wp_forms: 0,
		reset_processed_terms: 0,
		site_imported_data: null,

		backup_taken: false,


		templateData: {},

		log_file        : '',
		customizer_data : '',
		wxr_url         : '',
		wpforms_url     : '',
		cartflows_url     : '',
		options_data    : '',
		widgets_data    : '',
		action_slug		: '',
		import_start_time  : '',
		import_end_time    : '',

		init: function()
		{
			this._show_default_page_builder_sites();
			this._bind();
			this._autocomplete();
			this._load_large_images();
		},

		/**
		 * load large image
		 * 
		 * @return {[type]} [description]
		 */
		_load_large_image: function( el ) {
			if( el.hasClass('loaded') ) {
				return;
			}

			if( el.parents('.astra-theme').isInViewport() ) {
				var large_img_url = el.data('src') || '';
				var imgLarge = new Image();
				imgLarge.src = large_img_url; 
				imgLarge.onload = function () {
					el.removeClass('loading');
					el.addClass('loaded');
					el.css('background-image', 'url(\''+imgLarge.src+'\'' );
				};
			}
		},

		_load_large_images: function() {
			$('.theme-screenshot').each(function( key, el) {
				AstraSitesAdmin._load_large_image( $(el) );
			});
		},

		_autocomplete: function() {

			var tags = astraSitesVars.api_sites_and_pages_tags || [];
			var sites = astraSitesVars.default_page_builder_sites || [];

			// Add site & pages tags in autocomplete.
			var strings = [];
			for( tag_index in tags ) {
				strings.push( _.unescape( tags[ tag_index ]['name'] ));
			}

			// Add site title's in autocomplete.
			for( site_id in sites ) {
				var title = _.unescape( sites[ site_id ]['title'] );

				// @todo check why below character not escape with function _.unescape();
				title = title.replace('&#8211;', '-' );

				strings.push( title );
			}
			
			strings = strings.filter(function(item, pos) {
			    return strings.indexOf(item) == pos;
			})
			strings = _.sortBy( strings );

		    $( "#wp-filter-search-input" ).autocomplete({
		    	appendTo: ".astra-sites-autocomplete-result",
		    	classes: {
				    "ui-autocomplete": "astra-sites-auto-suggest"
				},
		    	source: function(request, response) {
			        var results = $.ui.autocomplete.filter(strings, request.term);

			        // Show only 10 results.
			        response(results.slice(0, 15));
			    },
		    	open: function( event, ui ) {
		    		$('.search-form').addClass( 'searching' );
		    	},
		    	close: function( event, ui ) {
		    		$('.search-form').removeClass( 'searching' );
		    	}
		    });

		    $( "#wp-filter-search-input" ).focus();
		},

		/**
		 * Debugging.
		 *
		 * @param  {mixed} data Mixed data.
		 */
		_log: function( data ) {

			if( astraSitesVars.debug ) {

				var date = new Date();
				var time = date.toLocaleTimeString();

				if (typeof data == 'object') {
					console.log('%c ' + JSON.stringify( data ) + ' ' + time, 'background: #ededed; color: #444');
				} else {
					console.log('%c ' + data + ' ' + time, 'background: #ededed; color: #444');
				}
			}
		},

		_log_title: function( data, append ) {

			var markup = '<p>' +  data + '</p>';
			if (typeof data == 'object' ) {
				var markup = '<p>'  + JSON.stringify( data ) + '</p>';
			}

			if ( append ) {
				$('.current-importing-status-title').append( markup );
			} else {
				$('.current-importing-status-title').html( markup );
			}
		},

		/**
		 * Binds events for the Astra Sites.
		 *
		 * @since 1.0.0
		 * @access private
		 * @method _bind
		 */
		_bind: function()
		{
			$( window ).on( 'resize scroll'                    , AstraSitesAdmin._load_large_images);

			// Change page builder.
			$( document ).on( 'click'                    , '.nav-tab-wrapper .page-builders li', AstraSitesAdmin._ajax_change_page_builder);
			$( document ).on( 'click'                    , '#astra-sites-welcome-form .page-builders li', AstraSitesAdmin._change_page_builder);

			// Open & Close Popup.
			$( document ).on( 'click'					  , '.site-import-cancel, .astra-sites-result-preview .close', AstraSitesAdmin._close_popup );
			$( document ).on( 'click'					  , '.astra-sites-result-preview .overlay', AstraSitesAdmin._close_popup_by_overlay );
			
			// Page.
			$( document ).on( 'click', '.site-import-layout-button', AstraSitesAdmin.show_page_popup_from_sites);
			$( document ).on('click', '#astra-sites > .astra-sites-previewing-page .theme-screenshot, #astra-sites > .astra-sites-previewing-page .theme-name', AstraSitesAdmin.show_page_popup_from_search );
			$( document ).on( 'click', '.astra-sites-page-import-popup .site-install-site-button, .preview-page-from-search-result .site-install-site-button', AstraSitesAdmin.import_page_process);
			$( document ).on( 'astra-sites-after-site-pages-required-plugins'       , AstraSitesAdmin._page_api_call );

			// Site reset warning.
			$( document ).on( 'click'					  , '.astra-sites-reset-data .checkbox', AstraSitesAdmin._toggle_reset_notice );
			
			// Site.
			$( document ).on( 'click'                     , '.site-import-site-button', AstraSitesAdmin._show_site_popup);
			$( document ).on( 'click'                     , '.astra-sites-get-agency-bundle-button', AstraSitesAdmin._show_get_agency_bundle_notice);
			$( document ).on( 'click'                     , '.astra-sites-activate-license-button', AstraSitesAdmin._show_activate_license_notice);
			$( document ).on( 'click', '.astra-sites-site-import-popup .site-install-site-button', AstraSitesAdmin._resetData);

			// Skip & Import.
			$( document ).on( 'click', '.astra-sites-site-import-popup .astra-sites-skip-and-import', AstraSitesAdmin._show_first_import_screen);
			$( document ).on( 'astra-sites-after-astra-sites-required-plugins'       , AstraSitesAdmin._start_site_import );

			$( document ).on( 'astra-sites-reset-data'							, AstraSitesAdmin._backup_before_rest_options );
			$( document ).on( 'astra-sites-backup-settings-before-reset-done'	, AstraSitesAdmin._reset_customizer_data );
			$( document ).on( 'astra-sites-reset-customizer-data-done'			, AstraSitesAdmin._reset_site_options );
			$( document ).on( 'astra-sites-reset-site-options-done'				, AstraSitesAdmin._reset_widgets_data );
			$( document ).on( 'astra-sites-reset-widgets-data-done'				, AstraSitesAdmin._reset_terms );
			$( document ).on( 'astra-sites-delete-terms-done'					, AstraSitesAdmin._reset_wp_forms );
			$( document ).on( 'astra-sites-delete-wp-forms-done'				, AstraSitesAdmin._reset_posts );

			$( document ).on( 'astra-sites-reset-data-done'       		    , AstraSitesAdmin._recheck_backup_options );
			$( document ).on( 'astra-sites-backup-settings-done'       	    , AstraSitesAdmin._startImportCartFlows );
			$( document ).on( 'astra-sites-import-cartflows-done'       	, AstraSitesAdmin._startImportWPForms );
			$( document ).on( 'astra-sites-import-wpforms-done'       	    , AstraSitesAdmin._importCustomizerSettings );
			$( document ).on( 'astra-sites-import-customizer-settings-done' , AstraSitesAdmin._importXML );
			$( document ).on( 'astra-sites-import-xml-done'                 , AstraSitesAdmin.import_siteOptions );
			$( document ).on( 'astra-sites-import-options-done'             , AstraSitesAdmin._importWidgets );
			$( document ).on( 'astra-sites-import-widgets-done'             , AstraSitesAdmin._importEnd );

			// $( document ).on( 'astra-sites-import-wpforms'       	   	    , AstraSitesAdmin._startImportWPForms );

			// Tooltip.
			$( document ).on( 'click'                     , '.astra-sites-tooltip-icon', AstraSitesAdmin._toggle_tooltip);

			// Plugin install & activate.
			$( document ).on( 'wp-plugin-installing'      , AstraSitesAdmin._pluginInstalling);
			$( document ).on( 'wp-plugin-install-error'   , AstraSitesAdmin._installError);
			$( document ).on( 'wp-plugin-install-success' , AstraSitesAdmin._installSuccess);



			$( document ).on('click', '#astra-sites > .astra-sites-previewing-site .theme-screenshot, #astra-sites > .astra-sites-previewing-site .theme-name', AstraSitesAdmin._show_pages );
			$( document ).on('click'                     , '#single-pages .theme-screenshot', AstraSitesAdmin._change_site_preview_screenshot);
			$( document ).on('click'                     , '.astra-sites-show-favorite-button', AstraSitesAdmin._show_favorite);

			$( document ).on('click'                     , '.favorite-action-wrap', AstraSitesAdmin._toggle_favorite);
			$( document ).on('click', '.astra-previewing-single-pages .back-to-layout', AstraSitesAdmin._go_back );
			$( document ).on('click', '.astra-sites-showing-favorites .back-to-layout, .logo, .astra-sites-back', AstraSitesAdmin._show_sites );

			$( document ).on('keydown', AstraSitesAdmin._next_and_previous_sites );

			$( document ).on('click', '.astra-site-category a', AstraSitesAdmin._filterSites );

			$( document ).on('click', '.astra-sites-sync-library-button', AstraSitesAdmin._sync_library );
			$( document ).on('click', '.astra-sites-sync-library-message.success .notice-dismiss', AstraSitesAdmin._sync_library_complete );
			$( document ).on('click', '.page-builder-icon', AstraSitesAdmin._toggle_page_builder_list );
			$( document ).on('click', '.showing-page-builders #wpbody-content', AstraSitesAdmin._close_page_builder_list );
			$( document ).on('keyup input'                     , '#wp-filter-search-input', AstraSitesAdmin._search );
			$( document ).on('click'                     , '.ui-autocomplete .ui-menu-item', AstraSitesAdmin._show_search_term );
		},

		_show_search_term: function() {
			var search_term = $(this).text() || '';
			$('#wp-filter-search-input').val( search_term );
			$('#wp-filter-search-input').trigger( 'keyup' );
		},

		_search: function() {

			var search_input  = $( this ),
				search_term   = search_input.val() || '',
				sites         = $('#astra-sites > .astra-theme'),
				titles = $('#astra-sites > .astra-theme .theme-name');

			AstraSitesAdmin.close_pages_popup();

			if( search_term.length ) {

				search_input.addClass('has-input');

				$('#astra-sites-admin').addClass('searching');

				var items = AstraSitesAdmin._get_sites_and_pages_by_search_term( search_term );

				if( ! AstraSitesAdmin.isEmpty( items ) ) {
					AstraSitesAdmin.add_sites( items );
				} else {
					$('#astra-sites').html( wp.template('astra-sites-no-sites') );
				}
			} else {
				search_input.removeClass('has-input');
				$('#astra-sites-admin').removeClass('searching');
				AstraSitesAdmin.add_sites( astraSitesVars.default_page_builder_sites );
			}
		},

		/**
		 * Change URL
		 */
		_changeAndSetURL: function( url_params ) {
			var current_url = window.location.href;
			var current_url_separator = ( window.location.href.indexOf( "?" ) === -1 ) ? "?" : "&";
			var new_url = current_url + current_url_separator + decodeURIComponent( $.param( url_params ) );
			AstraSitesAdmin._changeURL( new_url );
		},

		/**
		 * Clean the URL.
		 * 
		 * @param  string url URL string.
		 * @return string     Change the current URL.
		 */
		_changeURL: function( url )
		{
			History.pushState(null, 'Starter Templates ‹ Fresh — WordPress', url);
		},

		/**
		 * Get URL param.
		 */
		_getParamFromURL: function(name, url)
		{
		    if (!url) url = window.location.href;
		    name = name.replace(/[\[\]]/g, "\\$&");
		    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		        results = regex.exec(url);
		    if (!results) return null;
		    if (!results[2]) return '';
		    return decodeURIComponent(results[2].replace(/\+/g, " "));
		},

		_clean_url_params: function( single_param )
		{
			var url_params = AstraSitesAdmin._getQueryStrings();
			delete url_params[ single_param ];
			delete url_params[''];		// Removed extra empty object.

			var current_url = window.location.href;
			var root_url = current_url.substr(0, current_url.indexOf('?')); 
			if( $.isEmptyObject( url_params ) ) {
				var new_url = root_url + decodeURIComponent( $.param( url_params ) );
			} else {
				var current_url_separator = ( root_url.indexOf( "?" ) === -1 ) ? "?" : "&";
				var new_url = root_url + current_url_separator + decodeURIComponent( $.param( url_params ) );
			}

			AstraSitesAdmin._changeURL( new_url );
		},

		/**
		 * Get query strings.
		 * 
		 * @param  string string Query string.
		 * @return string     	 Check and return query string.
		 */
		_getQueryStrings: function( string )
		{
			return ( string || document.location.search).replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
		},

		isEmpty: function(obj) {
		    for(var key in obj) {
		        if(obj.hasOwnProperty(key))
		            return false;
		    }
		    return true;
		},

		_unescape( input_string ) {
			var title = _.unescape( input_string );

			// @todo check why below character not escape with function _.unescape();
			title = title.replace('&#8211;', '-' );

			return title;
		},

		_unescape_lower( input_string ) {
			var input_string = AstraSitesAdmin._unescape( input_string );
			return input_string.toLowerCase();
		},

		_get_sites_and_pages_by_search_term: function( search_term ) {

			var items = [];
			search_term = search_term.toLowerCase();

			for( site_id in astraSitesVars.default_page_builder_sites ) {

				var current_site = astraSitesVars.default_page_builder_sites[site_id];

				// Check in site title.
				if( current_site['title'] ) {
					var site_title = AstraSitesAdmin._unescape_lower( current_site['title'] );

					if( site_title.toLowerCase().includes( search_term ) ) {
						items[site_id] = current_site;
						items[site_id]['type'] = 'site';
						items[site_id]['site_id'] = site_id;
						items[site_id]['pages-count'] = Object.keys( current_site['pages'] ).length;
					}
				}

				// Check in site tags.
				if( Object.keys( current_site['astra-sites-tag'] ).length ) {
					for( site_tag_id in current_site['astra-sites-tag'] ) {
						var tag_title = AstraSitesAdmin._unescape_lower( current_site['astra-sites-tag'][site_tag_id] );

						if( tag_title.toLowerCase().includes( search_term ) ) {
							items[site_id] = current_site;
							items[site_id]['type'] = 'site';
							items[site_id]['site_id'] = site_id;
							items[site_id]['pages-count'] = Object.keys( current_site['pages'] ).length;
						}
					}
				}

				// Check in page title.
				if( Object.keys( current_site['pages'] ).length ) {
					var pages = current_site['pages'];

					for( page_id in pages ) {

						// Check in site title.
						if( pages[page_id]['title'] ) {

							var page_title = AstraSitesAdmin._unescape_lower( pages[page_id]['title'] );

							if( page_title.toLowerCase().includes( search_term ) ) {
								items[page_id] = pages[page_id];
								items[page_id]['type'] = 'page';
								items[page_id]['site_id'] = site_id;
								items[page_id]['astra-sites-type'] = current_site['astra-sites-type'] || '';
								items[page_id]['site-title'] = current_site['title'] || '';
							}
						}

						// Check in site tags.
						if( Object.keys( pages[page_id]['astra-sites-tag'] ).length ) {
							for( page_tag_id in pages[page_id]['astra-sites-tag'] ) {
								var page_tag_title = AstraSitesAdmin._unescape_lower( pages[page_id]['astra-sites-tag'][page_tag_id] );
								if( page_tag_title.toLowerCase().includes( search_term ) ) {
									items[page_id] = pages[page_id];
									items[page_id]['type'] = 'page';
									items[page_id]['site_id'] = site_id;
									items[page_id]['astra-sites-type'] = current_site['astra-sites-type'] || '';
									items[page_id]['site-title'] = current_site['title'] || '';
								}
							}
						}

					}
				}
			}

			return items;
		},

		_close_page_builder_list: function( event ) {
			event.preventDefault();
			$('body').removeClass( 'showing-page-builders' );
			$('.page-builder-icon').removeClass( 'active' );
		},

		_toggle_page_builder_list: function( event ) {
			event.preventDefault();
			$(this).toggleClass( 'active' );
			$('body').toggleClass( 'showing-page-builders' );
		},

		_sync_library_complete: function( event ) {
			event.preventDefault();

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-update-library-complete',
				},
			});
		},

		_sync_library: function( event ) {
			event.preventDefault();
			var button = $(this);

			if( button.hasClass( 'updating-message') ) {
				return;
			}

			button.addClass( 'updating-message');

			var noticeContent = wp.updates.adminNotice( {
				className: 'astra-sites-sync-library-message notice notice-alt notice-info is-dismissible',
				message:   'Syncing template library in the background! We will notify you once it done. <button type="button" class="notice-dismiss"><span class="screen-reader-text">'+commonL10n.dismiss+'</span></button>',
			} );

			button.parents('li').append( noticeContent );

			$(document).trigger( 'wp-updates-notice-added' );

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-update-library',
				},
			})
			.fail(function( jqXHR ){
				console.log( jqXHR );
		    })
			.done(function ( response ) {

				setTimeout(function() {
					$('.astra-sites-sync-library-message').remove();
				}, 3000);

				button.removeClass( 'updating-message');

				if( 'ajax' === response.data ) {

					// Import categories.
					$.ajax({
						url  : astraSitesVars.ajaxurl,
						type : 'POST',
						data : {
							action : 'astra-sites-import-categories',
						},
					})
					.fail(function( jqXHR ){
						console.log( jqXHR );
				    });

					$.ajax({
						url  : astraSitesVars.ajaxurl,
						type : 'POST',
						data : {
							action : 'astra-sites-get-sites-request-count',
						},
					})
					.fail(function( jqXHR ){
						console.log( jqXHR );
				    })
					.done(function ( response ) {
						if( response.success ) {
							var total = response.data;

							for( let i = 1; i <= total; i++ ) {
								AstraSitesAjaxQueue.add({
									url: astraSitesVars.ajaxurl,
									type: 'POST',
									data: {
										action  : 'astra-sites-import-sites',
										page_no : i,
									}
								});
							}

							// Run the AJAX queue.
							AstraSitesAjaxQueue.run();
						}
					});
				}
			});
		},

		_filterSites: function( event ) {
			event.preventDefault();
			var current_class = $(this).attr('data-group') || '';
			$( this ).parents('.filter-links').find('a').removeClass( 'current' );
			$( this ).addClass( 'current' );

			var search_term = $( this ).text() || '';

			if( current_class ) {
				if( $('#astra-sites .astra-theme.'+current_class).length ) {
					$('#wp-filter-search-input').val( search_term );

					// $('#astra-sites .astra-theme').removeClass('astra-show-site astra-hide-site');
					$('#astra-sites .astra-theme').addClass( 'astra-hide-site' );
					$('#astra-sites .astra-theme.'+current_class).removeClass( 'astra-hide-site' ).addClass( 'astra-show-site');
				}
			} else {
				$('#astra-sites .astra-theme').removeClass( 'astra-hide-site' ).addClass( 'astra-show-site');
			}

			$('.filters-wrap-page-categories').removeClass('show');
		},

		_next_and_previous_sites: function(e) {

	        if( ! $('body').hasClass('astra-previewing-single-pages') ) {
	        	return;
	        }

	        if( e.key === "Escape") {
	        	AstraSitesAdmin.close_pages_popup();
	        	return;
	        }

	        switch(e.which) {
	
	            // Left Key Pressed
	            case 37:
	            		if( $('#astra-sites > .astra-theme.current').prev().length ) {
		            		$('#astra-sites > .astra-theme.current').prev().addClass('current').siblings().removeClass('current');
		  					var site_id = $('#astra-sites > .astra-theme.current').prev().attr('data-site-id') || '';
		  					if( site_id ) {
		  						AstraSitesAdmin.show_pages_by_site_id( site_id );
		  					}
	            		}
	                break;

	            // Right Key Pressed
	            case 39:
	            		if( $('#astra-sites > .astra-theme.current').next().length ) {
		            		$('#astra-sites > .astra-theme.current').next().addClass('current').siblings().removeClass('current');
		  					var site_id = $('#astra-sites > .astra-theme.current').next().attr('data-site-id') || '';
		  					if( site_id ) {
		  						AstraSitesAdmin.show_pages_by_site_id( site_id );
		  					}
	            		}
	                break;
	        }

		},

		show_pages_by_site_id: function( site_id, page_id ) {

			var sites = astraSitesVars.default_page_builder_sites || [];

			var data = sites[site_id];

			if( 'undefined' !== typeof data ) {
				var site_template  = wp.template('astra-sites-single-site-preview');

				if( ! AstraSitesAdmin._getParamFromURL( 'astra-site' ) ) {
					var url_params = {
						'astra-site' : site_id,
					};
					AstraSitesAdmin._changeAndSetURL( url_params );
				}

				$('#astra-sites').hide();
				$('#site-pages').show().html( site_template( data ) );

				$('body').addClass('astra-previewing-single-pages');
				$('#site-pages').attr( 'data-site-id', site_id);

				if( AstraSitesAdmin._getParamFromURL( 'astra-page' ) ) {
					AstraSitesAdmin._set_preview_screenshot_by_page( $('#single-pages .site-single[data-page-id="'+AstraSitesAdmin._getParamFromURL( 'astra-page' )+'"]') );
				// Has first item?
				// Then set default screnshot in preview.
				} else if( page_id && $('#single-pages .site-single[data-page-id="'+page_id+'"]').length ) {
					AstraSitesAdmin._set_preview_screenshot_by_page( $('#single-pages .site-single[data-page-id="'+page_id+'"]') );
				} else if( $('#single-pages .site-single').eq( 0 ).length ) {
					AstraSitesAdmin._set_preview_screenshot_by_page( $('#single-pages .site-single').eq( 0 ) );
				}

				$( document ).trigger( 'astra-sites-added-pages' );

				AstraSitesAdmin._load_large_images();
			}

		},

		_show_sites: function( event ) {

			event.preventDefault();

			$( '.astra-sites-show-favorite-button' ).removeClass( 'active' );
			$( 'body' ).removeClass( 'astra-sites-showing-favorites' );
			AstraSitesAdmin.add_sites( astraSitesVars.default_page_builder_sites );

			$('#wp-filter-search-input').val( '' );
			AstraSitesAdmin.close_pages_popup();
		},

		/**
		 * Go back to all sites view
		 *
		 * @since 2.0.0
		 * @return null
		 */
		_go_back: function( event ) {

			event.preventDefault();
	
			AstraSitesAdmin._clean_url_params( 'search' );
			AstraSitesAdmin.close_pages_popup();
		},

		close_pages_popup: function( ) {
			astraSitesVars.cpt_slug = 'astra-sites';

			$('#astra-sites').show();
			$('#site-pages').hide().html( '' );
			$('body').removeClass('astra-previewing-single-pages');
			$('.astra-sites-result-preview').hide();

			$('#astra-sites > .astra-theme').removeClass('current');

			AstraSitesAdmin._clean_url_params( 'astra-site' );
			AstraSitesAdmin._clean_url_params( 'astra-page' );
		},


		_toggle_favorite: function( event ) {

			let is_favorite = $( this ).data( 'favorite' );
			let parent = $( this ).parents( '.astra-theme' );
			let site_id = parent.data( 'site-id' ).toString();
			let new_array = Array();

			parent.toggleClass( 'is-favorite' );
			$( this ).data( 'favorite', ! is_favorite );

			if ( ! is_favorite ) {
				// Add.
				for ( value in astraSitesVars.favorite_data ) {
					new_array.push( astraSitesVars.favorite_data[value] );
				}
				new_array.push( site_id );
			} else {
				// Remove.
				for ( value in astraSitesVars.favorite_data ) {
					if ( site_id != astraSitesVars.favorite_data[value].toString() ) {
						new_array.push( astraSitesVars.favorite_data[value] );
					}
				}
			}
			astraSitesVars.favorite_data = new_array;

			// If in favorites preview window and unfavorite the item?
			if( $( 'body' ).hasClass('astra-sites-showing-favorites') && ! parent.hasClass('is-favorite') ) {
			
				// Then remove the favorite item from markup.
				parent.remove();

				// Show Empty Favorite message if there is not item in favorite.
				if( ! $('#astra-sites > .astra-theme').length ) {
					$('#astra-sites').html( wp.template( 'astra-sites-no-favorites' ) );
				}
			}

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				dataType: 'json',
				data : {
					action          : 'astra-sites-favorite',
					is_favorite 	: ! is_favorite,
					site_id 		: site_id
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText + ' ' + jqXHR.statusText, true );
		    })
			.done(function ( response ) {
				if( response.success ) {
					astraSitesVars.favorite_data = response.data.all_favorites;
				}
			});
		},


		_show_favorite: function() {

			AstraSitesAdmin.close_pages_popup();

			if( $( '.astra-sites-show-favorite-button' ).hasClass( 'active' ) ) {
				$( '.astra-sites-show-favorite-button' ).removeClass( 'active' );
				$( 'body' ).removeClass( 'astra-sites-showing-favorites' );
				AstraSitesAdmin.add_sites( astraSitesVars.default_page_builder_sites );
			} else {
				$( '.astra-sites-show-favorite-button' ).addClass( 'active' );
				$( 'body' ).addClass( 'astra-sites-showing-favorites' );
				var items = [];
				for( favorite_id in astraSitesVars.favorite_data ) {
					items[ astraSitesVars.favorite_data[favorite_id].toString() ] = astraSitesVars.default_page_builder_sites[astraSitesVars.favorite_data[favorite_id].toString()] || [];
				}
				if( ! AstraSitesAdmin.isEmpty( items ) ) {
					AstraSitesAdmin.add_sites( items );
					$( document ).trigger( 'astra-sites-added-sites' );

					AstraSitesAdmin._clean_url_params( 'search' );
					AstraSitesAdmin._clean_url_params( 'astra-site' );
					AstraSitesAdmin._clean_url_params( 'astra-page' );
					AstraSitesAdmin.close_pages_popup();
					if( ! AstraSitesAdmin._getParamFromURL('favorites') ) {
						var url_params = {
							'favorites' : 'show'
						};
						AstraSitesAdmin._changeAndSetURL( url_params );
					}

				} else {
					$('#astra-sites').html( wp.template( 'astra-sites-no-favorites' ) );
				}
			}

		},

		_set_preview_screenshot_by_page: function( element ) {
			var large_img_url = $(element).find( '.theme-screenshot' ).attr( 'data-featured-src' ) || '';
			var url = $(element).find( '.theme-screenshot' ).attr( 'data-src' ) || '';
			var page_name = $(element).find('.theme-name').text() || '';

			$( element ).siblings().removeClass( 'current_page' );
			$( element ).addClass( 'current_page' );

			var page_id = $( element ).attr( 'data-page-id' ) || '';
			if( page_id ) {

				AstraSitesAdmin._clean_url_params( 'astra-page' );

				var url_params = {
					'astra-page' : page_id,
				};
				AstraSitesAdmin._changeAndSetURL( url_params );
			}

			$( '.site-import-layout-button' ).removeClass( 'disabled' );
			if( page_name ) {
				$( '.site-import-layout-button' ).text('Import "'+page_name.trim()+'" Template');
			}

			if( url ) {
				$('.single-site-preview').animate({
			        scrollTop: 0
			    },0);
				$('.single-site-preview img').addClass('loading').attr( 'src', url );
				var imgLarge = new Image();
				imgLarge.src = large_img_url; 
				imgLarge.onload = function () {
					$('.single-site-preview img').removeClass('loading');
					$('.single-site-preview img').attr('src', imgLarge.src );
				};
			}
		},

		/**
		 * Preview Inner Pages for the Site
		 *
		 * @since 2.0.0
		 * @return null
		 */
		_change_site_preview_screenshot: function( event ) {
			event.preventDefault();

			var item = $(this).parents('.site-single');

			AstraSitesAdmin._set_preview_screenshot_by_page( item );
		},

		_show_pages: function( event ) {

			var perent = $(this).parents('.astra-theme');
			perent.siblings().removeClass('current');
			perent.addClass('current');

			var site_id = perent.attr('data-site-id') || '';
			AstraSitesAdmin.show_pages_by_site_id( site_id );
		},

		_apiAddParam_status: function() {
			if( astraSitesVars.sites && astraSitesVars.sites.status ) {
				AstraSitesAdmin._api_params['status'] = astraSitesVars.sites.status;
			}
		},

		// Add 'search'
		_apiAddParam_search: function() {
			var search_val = jQuery('#wp-filter-search-input').val() || '';
			if( '' !== search_val ) {
				AstraSitesAdmin._api_params['search'] = search_val;
			}
		},

		_apiAddParam_per_page: function() {
			// Add 'per_page'
			var per_page_val = 30;
			if( astraSitesVars.sites && astraSitesVars.sites["per-page"] ) {
				per_page_val = parseInt( astraSitesVars.sites["per-page"] );
			}
			AstraSitesAdmin._api_params['per_page'] = per_page_val;
		},

		_apiAddParam_astra_site_category: function() {
			// Add 'astra-site-category'
			var selected_category_id = jQuery( '.filter-links[data-category="' + astraSitesVars.category_slug + '"]' ).find('.current').data('group') || '';
			if( '' !== selected_category_id && 'all' !== selected_category_id ) {
				AstraSitesAdmin._api_params[astraSitesVars.category_slug] =  selected_category_id;
			} else if( astraSitesVars.sites && astraSitesVars['categories'].include ) {
				if( AstraSitesAdmin._isArray( astraSitesVars['categories'].include ) ) {
					AstraSitesAdmin._api_params[astraSitesVars.category_slug] = astraSitesVars['categories'].include.join(',');
				} else {
					AstraSitesAdmin._api_params[astraSitesVars.category_slug] = astraSitesVars['categories'].include;
				}
			}
		},

		_apiAddParam_astra_page_parent_category: function() {

			// Add 'site-pages-parent-category'
			if ( '' == astraSitesVars.parent_category) {
				return;
			}

			var selected_category_id = jQuery( '.filter-links[data-category="' + astraSitesVars.parent_category + '"]' ).find('.current').data('group') || '';
			if( '' !== selected_category_id && 'all' !== selected_category_id ) {
				AstraSitesAdmin._api_params[astraSitesVars.parent_category] =  selected_category_id;
			} else if( astraSitesVars.sites && astraSitesVars['categories'].include ) {
				if( AstraSitesAdmin._isArray( astraSitesVars['categories'].include ) ) {
					AstraSitesAdmin._api_params[astraSitesVars.parent_category] = astraSitesVars['categories'].include.join(',');
				} else {
					AstraSitesAdmin._api_params[astraSitesVars.parent_category] = astraSitesVars['categories'].include;
				}
			}
		},

		_apiAddParam_astra_site_page_builder: function() {
			// Add 'astra-site-page-builder'
			var selected_page_builder_id = jQuery( '.filter-links[data-category="' + astraSitesVars.page_builder + '"]' ).find('.current').data('group') || '';
			if( '' !== selected_page_builder_id && 'all' !== selected_page_builder_id ) {
				AstraSitesAdmin._api_params[astraSitesVars.page_builder] =  selected_page_builder_id;
			} else if( astraSitesVars.sites && astraSitesVars['page-builders'].include ) {
				if( AstraSitesAdmin._isArray( astraSitesVars['page-builders'].include ) ) {
					AstraSitesAdmin._api_params[astraSitesVars.page_builder] = astraSitesVars['page-builders'].include.join(',');
				} else {
					AstraSitesAdmin._api_params[astraSitesVars.page_builder] = astraSitesVars['page-builders'].include;
				}
			}
		},

		_apiAddParam_page: function() {
			// Add 'page'
			var page_val = parseInt(jQuery('body').attr('data-astra-demo-paged')) || 1;
			AstraSitesAdmin._api_params['page'] = page_val;
		},

		_apiAddParam_purchase_key: function() {
			if( astraSitesVars.sites && astraSitesVars.sites.purchase_key ) {
				AstraSitesAdmin._api_params['purchase_key'] = astraSitesVars.sites.purchase_key;
			}
		},

		_apiAddParam_site_url: function() {
			if( astraSitesVars.sites && astraSitesVars.sites.site_url ) {
				AstraSitesAdmin._api_params['site_url'] = astraSitesVars.sites.site_url;
			}
		},

		_show_default_page_builder_sites: function() {

			if( ! $('#astra-sites').length ) {
				return;
			}

			var favorites = AstraSitesAdmin._getParamFromURL('favorites');
			var search_term = AstraSitesAdmin._getParamFromURL('search');
			if( search_term ) {
				var items = AstraSitesAdmin._get_sites_and_pages_by_search_term( search_term );

				if( ! AstraSitesAdmin.isEmpty( items ) ) {
					AstraSitesAdmin.add_sites( items );
					$('#wp-filter-search-input').val( search_term );
				} else {
					$('#astra-sites').html( astraSitesVars.default_page_builder_sites );
				}

			} else if( favorites ) {
				AstraSitesAdmin._show_favorite();
			} else {
				AstraSitesAdmin.add_sites( astraSitesVars.default_page_builder_sites );
			}

			// Show single site preview.
			var site_id = AstraSitesAdmin._getParamFromURL('astra-site');
			if( site_id ) {
				AstraSitesAdmin.show_pages_by_site_id( site_id );
			}
		},

		_change_page_builder: function() {
			var page_builder = $( this ).attr('data-page-builder') || '';

			$( this ).parents('.page-builders').find('img').removeClass('active');
			$( this ).find('img').addClass('active');

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-change-page-builder',
					page_builder : page_builder,
				},
			})
			.done(function ( response ) {
				AstraSitesAdmin._clean_url_params( 'change-page-builder' );
				location.reload();
			});
		},

		_ajax_change_page_builder: function() {
			// $(this).attr('data-page-builder') || '';
		
			var page_builder_slug = $(this).attr('data-page-builder') || '';
			var page_builder_img = $(this).find('img').attr('src') || '';
			var page_builder_title = $(this).find('.title').text() || '';
			if( page_builder_img ) {
				$('.selected-page-builder').find('img').attr('src', page_builder_img );
			}
			if( page_builder_title ) {
				$('.selected-page-builder').find('.page-builder-title').text( page_builder_title );
			}

			$('#wp-filter-search-input').val( '' );
			$('#astra-sites-admin').removeClass('searching');

			if( $('.page-builders [data-page-builder="'+page_builder_slug+'"]').length ) {
				$('.page-builders [data-page-builder="'+page_builder_slug+'"]').siblings().removeClass('active');
				$('.page-builders [data-page-builder="'+page_builder_slug+'"]').addClass('active');
			}

			if( page_builder_slug ) {

				$('#astra-sites').show();
				$('#site-pages').hide();

				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					data : {
						action : 'astra-sites-change-page-builder',
						page_builder : page_builder_slug,
					},
				})
				.done(function ( response ) {
					if( response.success ) {
						// Set changed page builder data as a default page builder object.
						astraSitesVars.default_page_builder_sites = response.data;
						$('.astra-sites-show-favorite-button').removeClass('active');
						AstraSitesAdmin.add_sites( response.data );
					}
				});

			}
		},

		add_sites: function( data ) {
			var template = wp.template( 'astra-sites-page-builder-sites' );
    		$('#astra-sites').html( template( data ) );
    		AstraSitesAdmin._load_large_images();
    		$( document ).trigger( 'astra-sites-added-sites' );
		},

		_toggle_tooltip: function( event ) {
			event.preventDefault();
			var tip_id = $( this ).data('tip-id') || '';
			if( tip_id && $( '#' + tip_id ).length ) {
				$( '#' + tip_id ).toggle();
			}
		},

		_resetData: function(event) {
			event.preventDefault();

			AstraSitesAdmin.import_start_time = new Date();

			if( $( this ).hasClass('updating-message') ) {
				return;
			}

			$(this).addClass('updating-message installing').text( wp.updates.l10n.installing );
			$('body').addClass('importing-site');
			$('.astra-sites-result-preview .inner > h2').text('We\'re importing your website.');
			$('.install-theme-info').hide();
			$('.ast-importing-wrap').show();
			var output = '<div class="current-importing-status-title"></div><div class="current-importing-status-description"></div>';
			$('.current-importing-status').html( output );

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-set-reset-data',
				},
			})
			.done(function ( response ) {
				if( response.success ) {
					AstraSitesAdmin.site_imported_data = response.data;

					// Process Bulk Plugin Install & Activate.
					AstraSitesAdmin._bulkPluginInstallActivate();
				}
			});

		},

		_show_first_import_screen: function() {
			$('.astra-sites-skip-and-import').hide();
			$('.astra-demo-import').show();
			$('.astra-sites-advanced-options').show();
			$('.astra-sites-third-party-required-plugins-wrap').hide();
		},

		_start_site_import: function() {
			if ( $( '.astra-sites-reset-data' ).find('.checkbox').is(':checked') ) {
				$(document).trigger( 'astra-sites-reset-data' );
			} else {
				$(document).trigger( 'astra-sites-reset-data-done' );
			}
		},

		_reset_customizer_data: function() {
			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-reset-customizer-data'
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Reseting Customizer Data..' );
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText + ' ' + jqXHR.statusText, true );
		    })
			.done(function ( data ) {
				AstraSitesAdmin._log_title( 'Complete Resetting Customizer Data..' );
				$(document).trigger( 'astra-sites-reset-customizer-data-done' );
			});
		},

		_reset_site_options: function() {
			// Site Options.
			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-reset-site-options'
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Reseting Site Options..' );
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText + ' ' + jqXHR.statusText, true );
		    })
			.done(function ( data ) {
				AstraSitesAdmin._log_title( 'Complete Reseting Site Options..' );
				$(document).trigger( 'astra-sites-reset-site-options-done' );
			});
		},

		_reset_widgets_data: function() {
			// Widgets.
			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-reset-widgets-data'
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Reseting Widgets..' );
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText + ' ' + jqXHR.statusText, true );
		    })
			.done(function ( data ) {
				AstraSitesAdmin._log_title( 'Complete Reseting Widgets..' );
				$(document).trigger( 'astra-sites-reset-widgets-data-done' );
			});
		},

		_reset_posts: function() {
			if( AstraSitesAdmin.site_imported_data['reset_posts'].length ) {

				AstraSitesAdmin.reset_remaining_posts = AstraSitesAdmin.site_imported_data['reset_posts'].length;

				$.each( AstraSitesAdmin.site_imported_data['reset_posts'], function(index, post_id) {

					AstraSitesAdmin._log_title( 'Deleting Posts..' );

					AstraSitesAjaxQueue.add({
						url: astraSitesVars.ajaxurl,
						type: 'POST',
						data: {
							action  : 'astra-sites-delete-posts',
							post_id : post_id,
						},
						success: function( result ){

							if( AstraSitesAdmin.reset_processed_posts < AstraSitesAdmin.site_imported_data['reset_posts'].length ) {
								AstraSitesAdmin.reset_processed_posts+=1;
							}

							AstraSitesAdmin._log_title( 'Deleting Post ' + AstraSitesAdmin.reset_processed_posts + ' of ' + AstraSitesAdmin.site_imported_data['reset_posts'].length + '<br/>' + result.data );

							AstraSitesAdmin.reset_remaining_posts-=1;
							if( 0 == AstraSitesAdmin.reset_remaining_posts ) {
								$(document).trigger( 'astra-sites-delete-posts-done' );
								$(document).trigger( 'astra-sites-reset-data-done' );
							}
						}
					});
				});
				AstraSitesAjaxQueue.run();

			} else {
				$(document).trigger( 'astra-sites-delete-posts-done' );
				$(document).trigger( 'astra-sites-reset-data-done' );
			}
		},

		_reset_wp_forms: function() {

			if( AstraSitesAdmin.site_imported_data['reset_wp_forms'].length ) {
				AstraSitesAdmin.reset_remaining_wp_forms = AstraSitesAdmin.site_imported_data['reset_wp_forms'].length;

				$.each( AstraSitesAdmin.site_imported_data['reset_wp_forms'], function(index, post_id) {
					AstraSitesAdmin._log_title( 'Deleting WP Forms..' );
					AstraSitesAjaxQueue.add({
						url: astraSitesVars.ajaxurl,
						type: 'POST',
						data: {
							action  : 'astra-sites-delete-wp-forms',
							post_id : post_id,
						},
						success: function( result ){

							if( AstraSitesAdmin.reset_processed_wp_forms < AstraSitesAdmin.site_imported_data['reset_wp_forms'].length ) {
								AstraSitesAdmin.reset_processed_wp_forms+=1;
							}

							AstraSitesAdmin._log_title( 'Deleting Form ' + AstraSitesAdmin.reset_processed_wp_forms + ' of ' + AstraSitesAdmin.site_imported_data['reset_wp_forms'].length + '<br/>' + result.data );

							AstraSitesAdmin.reset_remaining_wp_forms-=1;
							if( 0 == AstraSitesAdmin.reset_remaining_wp_forms ) {
								$(document).trigger( 'astra-sites-delete-wp-forms-done' );
							}
						}
					});
				});
				AstraSitesAjaxQueue.run();

			} else {
				$(document).trigger( 'astra-sites-delete-wp-forms-done' );
			}
		},


		_reset_terms: function() {


			if( AstraSitesAdmin.site_imported_data['reset_terms'].length ) {
				AstraSitesAdmin.reset_remaining_terms = AstraSitesAdmin.site_imported_data['reset_terms'].length;

				$.each( AstraSitesAdmin.site_imported_data['reset_terms'], function(index, term_id) {
					AstraSitesAdmin._log_title( 'Deleting Terms..' );
					AstraSitesAjaxQueue.add({
						url: astraSitesVars.ajaxurl,
						type: 'POST',
						data: {
							action  : 'astra-sites-delete-terms',
							term_id : term_id,
						},
						success: function( result ){
							if( AstraSitesAdmin.reset_processed_terms < AstraSitesAdmin.site_imported_data['reset_terms'].length ) {
								AstraSitesAdmin.reset_processed_terms+=1;
							}

							AstraSitesAdmin._log_title( 'Deleting Term ' + AstraSitesAdmin.reset_processed_terms + ' of ' + AstraSitesAdmin.site_imported_data['reset_terms'].length + '<br/>' + result.data );

							AstraSitesAdmin.reset_remaining_terms-=1;
							if( 0 == AstraSitesAdmin.reset_remaining_terms ) {
								$(document).trigger( 'astra-sites-delete-terms-done' );
							}
						}
					});
				});
				AstraSitesAjaxQueue.run();

			} else {
				$(document).trigger( 'astra-sites-delete-terms-done' );
			}

		},

		_toggle_reset_notice: function() {
			if ( $( this ).is(':checked') ) {
				$('#astra-sites-tooltip-reset-data').show();
			} else {
				$('#astra-sites-tooltip-reset-data').hide();
			}
		},

		_backup_before_rest_options: function() {
			AstraSitesAdmin._backupOptions( 'astra-sites-backup-settings-before-reset-done' );
			AstraSitesAdmin.backup_taken = true;
		},

		_recheck_backup_options: function() {
			AstraSitesAdmin._backupOptions( 'astra-sites-backup-settings-done' );
			AstraSitesAdmin.backup_taken = true;
		},

		_backupOptions: function( trigger_name ) {
			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action : 'astra-sites-backup-settings',
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Processing Customizer Settings Backup..' );
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
		    })
			.done(function ( data ) {

				// 1. Pass - Import Customizer Options.
				AstraSitesAdmin._log_title( 'Customizer Settings Backup Done..' );

				// Custom trigger.
				$(document).trigger( trigger_name );
			});
		},

		/**
		 * 5. Import Complete.
		 */
		_importEnd: function( event ) {

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				dataType: 'json',
				data : {
					action : 'astra-sites-import-end',
					data : AstraSitesAdmin.templateData,
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Import Complete!' );
				}
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText + ' ' + jqXHR.statusText, true );
		    })
			.done(function ( data ) {

				// 5. Fail - Import Complete.
				if( false === data.success ) {
					AstraSitesAdmin._log_title( data.data );
				} else {

					$('body').removeClass('importing-site');
					$('.previous-theme, .next-theme').removeClass('disabled');

					var date = new Date();

					AstraSitesAdmin.import_end_time = new Date();
					var diff    = ( AstraSitesAdmin.import_end_time.getTime() - AstraSitesAdmin.import_start_time.getTime() );

					var time    = '';
					var seconds = Math.floor( diff / 1000 );
					var minutes = Math.floor( seconds / 60 );
					var hours   = Math.floor( minutes / 60 );

					minutes = minutes - ( hours * 60 );
					seconds = seconds - ( minutes * 60 );

					if( hours ) {
						time += hours + ' Hours ';
					}
					if( minutes ) {
						time += minutes + ' Minutes ';
					}
					if( seconds ) {
						time += seconds + ' Seconds';
					}

					var template = wp.template( 'astra-sites-install-activate-theme' );
					$('.rotating,.current-importing-status-wrap,.notice-warning').remove();
					$('.astra-sites-result-preview').addClass('astra-sites-result-preview');
					$('.astra-sites-result-preview .astra-sites-import-content').html( template( time ) );
						
					var button = '<a class="button button-primary button-hero" href="'+astraSitesVars.siteURL+'" target="_blank">View Site <i class="dashicons dashicons-external"></i></a>';
					$('.astra-sites-result-preview .ast-actioms-wrap').html(button);

					$('.astra-sites-result-preview .inner > h2').text( 'Done 🎉' );

					// 5. Pass - Import Complete.
					AstraSitesAdmin._importSuccessButton();
				}
			});
		},

		/**
		 * 4. Import Widgets.
		 */
		_importWidgets: function( event ) {
			if ( AstraSitesAdmin._is_process_widgets() ) {
				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action       : 'astra-sites-import-widgets',
						widgets_data : AstraSitesAdmin.widgets_data,
					},
					beforeSend: function() {
						AstraSitesAdmin._log_title( 'Importing Widgets..' );
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( widgets_data ) {

					// 4. Fail - Import Widgets.
					if( false === widgets_data.success ) {
						AstraSitesAdmin._log_title( widgets_data.data );

					} else {

						// 4. Pass - Import Widgets.
						AstraSitesAdmin._log( astraSitesVars.log.importWidgetsSuccess );
						$(document).trigger( 'astra-sites-import-widgets-done' );
					}
				});
			} else {
				$(document).trigger( 'astra-sites-import-widgets-done' );
			}
		},

		/**
		 * 3. Import Site Options.
		 */
		import_siteOptions: function( event ) {

			if ( AstraSitesAdmin._is_process_xml() ) {
				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action       : 'astra-sites-import-options',
						options_data : AstraSitesAdmin.options_data,
					},
					beforeSend: function() {
						AstraSitesAdmin._log_title( 'Importing Options..' );
						$('.astra-demo-import .percent').html('');
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( options_data ) {

					// 3. Fail - Import Site Options.
					if( false === options_data.success ) {
						AstraSitesAdmin._log_title( options_data );
					} else {

						// 3. Pass - Import Site Options.
						$(document).trigger( 'astra-sites-import-options-done' );
					}
				});
			} else {
				$(document).trigger( 'astra-sites-import-options-done' );
			}
		},

		/**
		 * 2. Prepare XML Data.
		 */
		_importXML: function() {

			if ( AstraSitesAdmin._is_process_xml() ) {
				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action  : 'astra-sites-import-prepare-xml',
						wxr_url : AstraSitesAdmin.wxr_url, // AstraSitesAdmin.current_site['astra-site-wxr-path'],
					},
					beforeSend: function() {
						$('.astra-site-import-process-wrap').show();
						AstraSitesAdmin._log_title( 'Importing Content..' );
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( xml_data ) {

					// 2. Fail - Prepare XML Data.
					if( false === xml_data.success ) {
						AstraSitesAdmin._log_title( xml_data );
						var error_msg = xml_data.data.error || xml_data.data;
						AstraSitesAdmin._log_title( error_msg );

					} else {

						var xml_processing = $('.astra-demo-import').attr( 'data-xml-processing' );

						if( 'yes' === xml_processing ) {
							return;
						}

						$('.astra-demo-import').attr( 'data-xml-processing', 'yes' );

						// 2. Pass - Prepare XML Data.

						// Import XML though Event Source.
						AstraSSEImport.data = xml_data.data;
						AstraSSEImport.render();

						$('.current-importing-status-description').html('').show();

						$('.current-importing-status-wrap').append('<div class="astra-site-import-process-wrap"><progress class="astra-site-import-process" max="100" value="0"></progress></div>');

						var evtSource = new EventSource( AstraSSEImport.data.url );
						evtSource.onmessage = function ( message ) {
							var data = JSON.parse( message.data );
							switch ( data.action ) {
								case 'updateDelta':

										AstraSSEImport.updateDelta( data.type, data.delta );
									break;

								case 'complete':
									evtSource.close();

									$('.current-importing-status-description').hide();
									$('.astra-demo-import').removeAttr( 'data-xml-processing' );

									document.getElementsByClassName("astra-site-import-process").value = '100';

									$('.astra-site-import-process-wrap').hide();

									$(document).trigger( 'astra-sites-import-xml-done' );

									break;
							}
						};
						evtSource.addEventListener( 'log', function ( message ) {
							var data = JSON.parse( message.data );
							var message = data.message || '';
							if( message && 'info' === data.level ) {
								message = message.replace(/"/g, function(letter) {
								    return '';
								});
								$('.current-importing-status-description').html( message );
							}
						});
					}
				});
			} else {
				$(document).trigger( 'astra-sites-import-xml-done' );
			}
		},

		_is_process_xml: function() {
			if ( $( '.astra-sites-import-xml' ).find('.checkbox').is(':checked') ) {
				return true;
			}
			return false;
		},

		_is_process_customizer: function() {
			if ( $( '.astra-sites-import-customizer' ).find('.checkbox').is(':checked') ) {
				return true;
			}
			return false;
		},

		_is_process_widgets: function() {
			if ( $( '.astra-sites-import-widgets' ).find('.checkbox').is(':checked') ) {
				return true;
			}
			return false;
		},

		_startImportCartFlows: function( event ) {

			if ( AstraSitesAdmin._is_process_xml() && '' !== AstraSitesAdmin.cartflows_url ) {

				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action      : 'astra-sites-import-cartflows',
						cartflows_url : AstraSitesAdmin.cartflows_url,
					},
					beforeSend: function() {
						AstraSitesAdmin._log_title( 'Importing Flows & Steps..' );
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( forms ) {

					// 1. Fail - Import WPForms Options.
					if( false === forms.success ) {
						AstraSitesAdmin._log_title( forms.data );
					} else {
						// 1. Pass - Import Customizer Options.
						$(document).trigger( AstraSitesAdmin.action_slug + '-import-cartflows-done' );
					}
				});

			} else {
				$(document).trigger( AstraSitesAdmin.action_slug + '-import-cartflows-done' );
			}

		},

		_startImportWPForms: function( event ) {

			if ( AstraSitesAdmin._is_process_xml() && '' !== AstraSitesAdmin.wpforms_url ) {

				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action      : 'astra-sites-import-wpforms',
						wpforms_url : AstraSitesAdmin.wpforms_url,
					},
					beforeSend: function() {
						AstraSitesAdmin._log_title( 'Importing WP Forms..' );
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( forms ) {

					// 1. Fail - Import WPForms Options.
					if( false === forms.success ) {
						AstraSitesAdmin._log_title( forms.data );
					} else {
						// 1. Pass - Import Customizer Options.
						$(document).trigger( AstraSitesAdmin.action_slug + '-import-wpforms-done' );
					}
				});

			} else {
				$(document).trigger( AstraSitesAdmin.action_slug + '-import-wpforms-done' );
			}

		},

		/**
		 * 1. Import Customizer Options.
		 */
		_importCustomizerSettings: function( event ) {
			if ( AstraSitesAdmin._is_process_customizer() ) {
				$.ajax({
					url  : astraSitesVars.ajaxurl,
					type : 'POST',
					dataType: 'json',
					data : {
						action          : 'astra-sites-import-customizer-settings',
						customizer_data : AstraSitesAdmin.customizer_data,
					},
					beforeSend: function() {
					},
				})
				.fail(function( jqXHR ){
					AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
			    })
				.done(function ( customizer_data ) {

					// 1. Fail - Import Customizer Options.
					if( false === customizer_data.success ) {
						AstraSitesAdmin._log_title( customizer_data.data );
					} else {
						// 1. Pass - Import Customizer Options.
						$(document).trigger( 'astra-sites-import-customizer-settings-done' );
					}
				});
			} else {
				$(document).trigger( 'astra-sites-import-customizer-settings-done' );
			}

		},

		/**
		 * Import Success Button.
		 *
		 * @param  {string} data Error message.
		 */
		_importSuccessButton: function() {

			$('.astra-demo-import').removeClass('updating-message installing')
				.removeAttr('data-import')
				.addClass('view-site')
				.removeClass('astra-demo-import')
				.text( astraSitesVars.strings.viewSite )
				.attr('target', '_blank')
				.append('<i class="dashicons dashicons-external"></i>')
				.attr('href', astraSitesVars.siteURL );
		},

		/**
		 * Import Error Button.
		 *
		 * @param  {string} data Error message.
		 */
		_importFailMessage: function( message, from ) {

			$('.astra-demo-import')
				.addClass('go-pro button-primary')
				.removeClass('updating-message installing')
				.removeAttr('data-import')
				.attr('target', '_blank')
				.append('<i class="dashicons dashicons-external"></i>')
				.removeClass('astra-demo-import');

			// Add the doc link due to import log file not generated.
			if( 'undefined' === from ) {

				$('.wp-full-overlay-header .go-pro').text( astraSitesVars.strings.importFailedBtnSmall );
				$('.wp-full-overlay-footer .go-pro').text( astraSitesVars.strings.importFailedBtnLarge );
				$('.go-pro').attr('href', astraSitesVars.log.serverConfiguration );

			// Add the import log file link.
			} else {

				$('.wp-full-overlay-header .go-pro').text( astraSitesVars.strings.importFailBtn );
				$('.wp-full-overlay-footer .go-pro').text( astraSitesVars.strings.importFailBtnLarge )

				// Add the import log file link.
				if( 'undefined' !== AstraSitesAdmin.log_file_url ) {
					$('.go-pro').attr('href', AstraSitesAdmin.log_file_url );
				} else {
					$('.go-pro').attr('href', astraSitesVars.log.serverConfiguration );
				}
			}

			var output  = '<div class="astra-api-error notice notice-error notice-alt is-dismissible">';
				output += '	<p>'+message+'</p>';
				output += '	<button type="button" class="notice-dismiss">';
				output += '		<span class="screen-reader-text">'+commonL10n.dismiss+'</span>';
				output += '	</button>';
				output += '</div>';

			// Fail Notice.
			$('.install-theme-info').append( output );
			// !important to add trigger.
			// Which reinitialize the dismiss error message events.
			$(document).trigger('wp-updates-notice-added');
		},

		ucwords: function( str ) {
			if( ! str ) {
				return '';
			}

			str = str.toLowerCase().replace(/\b[a-z]/g, function(letter) {
			    return letter.toUpperCase();
			});

			str = str.replace(/-/g, function(letter) {
			    return ' ';
			});

			return str;
		},

		/**
		 * Install Success
		 */
		_installSuccess: function( event, response ) {

			event.preventDefault();


			var $siteOptions = $( '.wp-full-overlay-header').find('.astra-site-options').val();

			var $enabledExtensions = $( '.wp-full-overlay-header').find('.astra-enabled-extensions').val();

			// Transform the 'Install' button into an 'Activate' button.
			var $init = $( '.plugin-card-' + response.slug ).data('init');
			var $name = $( '.plugin-card-' + response.slug ).data('name');

			// Reset not installed plugins list.
			var pluginsList = astraSitesVars.requiredPlugins.notinstalled;
			astraSitesVars.requiredPlugins.notinstalled = AstraSitesAdmin._removePluginFromQueue( response.slug, pluginsList );

			// WordPress adds "Activate" button after waiting for 1000ms. So we will run our activation after that.
			setTimeout( function() {

				AstraSitesAdmin._log_title( 'Installing Plugin - ' + AstraSitesAdmin.ucwords($name) );

				$.ajax({
					url: astraSitesVars.ajaxurl,
					type: 'POST',
					data: {
						'action'            : 'astra-required-plugin-activate',
						'init'              : $init,
						'options'           : $siteOptions,
						'enabledExtensions' : $enabledExtensions,
					},
				})
				.done(function (result) {

					if( result.success ) {
						var pluginsList = astraSitesVars.requiredPlugins.inactive;

						AstraSitesAdmin._log_title( 'Installed Plugin - ' + AstraSitesAdmin.ucwords($name) );

						// Reset not installed plugins list.
						astraSitesVars.requiredPlugins.inactive = AstraSitesAdmin._removePluginFromQueue( response.slug, pluginsList );

						// Enable Demo Import Button
						AstraSitesAdmin._enable_demo_import_button();

					}
				});

			}, 1200 );

		},

		/**
		 * Plugin Installation Error.
		 */
		_installError: function( event, response ) {

			var $card = $( '.plugin-card-' + response.slug );
			var $name = $card.data('name');

			AstraSitesAdmin._log_title( response.errorMessage + ' ' + AstraSitesAdmin.ucwords($name) );


			$card
				.removeClass( 'button-primary' )
				.addClass( 'disabled' )
				.html( wp.updates.l10n.installFailedShort );

		},

		/**
		 * Installing Plugin
		 */
		_pluginInstalling: function(event, args) {
			event.preventDefault();

			var $card = $( '.plugin-card-' + args.slug );
			var $name = $card.data('name');

			AstraSitesAdmin._log_title( 'Installing Plugin - ' + AstraSitesAdmin.ucwords( $name ));

			$card.addClass('updating-message');

		},

		/**
		 * Bulk Plugin Active & Install
		 */
		_bulkPluginInstallActivate: function()
		{
			if( 0 === astraSitesVars.requiredPlugins.length ) {
				return;
			}

			// If has class the skip-plugins then,
			// Avoid installing 3rd party plugins.
			var not_installed = astraSitesVars.requiredPlugins.notinstalled || '';
			if( $('.astra-sites-result-preview').hasClass('skip-plugins') ) {
				not_installed = [];
			}
			var activate_plugins = astraSitesVars.requiredPlugins.inactive || '';

			// First Install Bulk.
			if( not_installed.length > 0 ) {
				AstraSitesAdmin._installAllPlugins( not_installed );
			}

			// Second Activate Bulk.
			if( activate_plugins.length > 0 ) {
				AstraSitesAdmin._activateAllPlugins( activate_plugins );
			}

			if( activate_plugins.length <= 0 && not_installed.length <= 0 ) {
				AstraSitesAdmin._enable_demo_import_button();
			}

		},

		/**
		 * Activate All Plugins.
		 */
		_activateAllPlugins: function( activate_plugins ) {

			AstraSitesAdmin._log_title( 'Activating Required Plugins..' );

			$.each( activate_plugins, function(index, single_plugin) {

				var $card    	 = $( '.plugin-card-' + single_plugin.slug ),
					$siteOptions = $( '.wp-full-overlay-header').find('.astra-site-options').val(),
					$enabledExtensions = $( '.wp-full-overlay-header').find('.astra-enabled-extensions').val();


				AstraSitesAjaxQueue.add({
					url: astraSitesVars.ajaxurl,
					type: 'POST',
					data: {
						'action'            : 'astra-required-plugin-activate',
						'init'              : single_plugin.init,
						'options'           : $siteOptions,
						'enabledExtensions' : $enabledExtensions,
					},
					success: function( result ){

						if( result.success ) {

							var pluginsList = astraSitesVars.requiredPlugins.inactive;

							// Reset not installed plugins list.
							astraSitesVars.requiredPlugins.inactive = AstraSitesAdmin._removePluginFromQueue( single_plugin.slug, pluginsList );

							// Enable Demo Import Button
							AstraSitesAdmin._enable_demo_import_button();
						} else {
						}
					}
				});
			});
			AstraSitesAjaxQueue.run();
		},

		/**
		 * Install All Plugins.
		 */
		_installAllPlugins: function( not_installed ) {

			AstraSitesAdmin._log_title( astraSitesVars.log.bulkInstall );

			$.each( not_installed, function(index, single_plugin) {

				AstraSitesAdmin._log_title( 'Installing Plugin - ' + AstraSitesAdmin.ucwords( single_plugin.name ));

				var $card = $( '.plugin-card-' + single_plugin.slug );

				// Add each plugin activate request in Ajax queue.
				// @see wp-admin/js/updates.js
				wp.updates.queue.push( {
					action: 'install-plugin', // Required action.
					data:   {
						slug: single_plugin.slug
					}
				} );
			});

			// Required to set queue.
			wp.updates.queueChecker();
		},

		_show_get_agency_bundle_notice: function(event) {
			event.preventDefault();
			$('.astra-sites-result-preview')
				.removeClass('astra-sites-site-import-popup astra-sites-page-import-popup')
				.addClass('astra-sites-get-agency-bundle')
				.show();

			var template = wp.template( 'astra-sites-pro-site-description' );
	        var output  = '<div class="overlay"></div>';
	        	output += '<div class="inner"><div class="heading"><h2>Liked this demo?</h2></div><span class="dashicons close dashicons-no-alt"></span><div class="astra-sites-import-content">';
                output += '</div></div>';
			$('.astra-sites-result-preview').html( output );
	        $('.astra-sites-import-content').html( template );
		},

		_show_activate_license_notice: function(event) {
			event.preventDefault();
			$('.astra-sites-result-preview')
				.removeClass('astra-sites-site-import-popup astra-sites-page-import-popup')
				.addClass('astra-sites-activate-license')
				.show();

			var template = wp.template( 'astra-sites-activate-license' );
	        var output  = '<div class="overlay"></div>';
	        	output += '<div class="inner"><div class="heading"><h2>Liked this demo?</h2></div><span class="dashicons close dashicons-no-alt"></span><div class="astra-sites-import-content">';
                output += '</div></div>';
			$('.astra-sites-result-preview').html( output );
	        $('.astra-sites-import-content').html( template );
		},

		_get_id: function( site_id ) {
			return site_id.replace('id-', '');
		},

		/**
		 * Fires when a nav item is clicked.
		 *
		 * @since 1.0
		 * @access private
		 * @method _show_site_popup
		 */
		_show_site_popup: function(event) {
			event.preventDefault();

			if( $( this ).hasClass('updating-message') ) {
				return;
			}

			$('.astra-sites-result-preview')
				.removeClass('astra-sites-get-agency-bundle preview-page-from-search-result astra-sites-page-import-popup')
				.addClass('astra-sites-site-import-popup')
				.show();

			var template = wp.template( 'astra-sites-result-preview' );
			$('.astra-sites-result-preview').html( template( 'astra-sites' ) ).addClass('preparing');
			$('.astra-sites-import-content').append( '<div class="astra-loading-wrap"><div class="astra-loading-icon"></div></div>' );

				// .attr('data-slug', 'astra-sites');
			AstraSitesAdmin.action_slug = 'astra-sites';
			astraSitesVars.cpt_slug = 'astra-sites';

			// AstraSitesAdmin.required_plugins_list_markup();


			var site_id = $('#site-pages').attr( 'data-site-id') || '';

			site_id = AstraSitesAdmin._get_id( site_id );

			// AstraSitesAdmin.templateData
			// Add Params for API request.
			AstraSitesAdmin._api_params = {};

			AstraSitesAdmin._apiAddParam_status();
			// AstraSitesAdmin._apiAddParam_search();
			// AstraSitesAdmin._apiAddParam_per_page();
			AstraSitesAdmin._apiAddParam_astra_site_category();
			// AstraSitesAdmin._apiAddParam_page();
			AstraSitesAdmin._apiAddParam_astra_site_page_builder();
			AstraSitesAdmin._apiAddParam_astra_page_parent_category();
			AstraSitesAdmin._apiAddParam_site_url();
			AstraSitesAdmin._apiAddParam_purchase_key();
			var api_post = {
				id: astraSitesVars.cpt_slug,
				slug: astraSitesVars.cpt_slug + '/' + site_id + '?' + decodeURIComponent( $.param( AstraSitesAdmin._api_params ) ),
			};

			var has_visited = false;
			
			if( AstraSitesAdmin.visited_sites_and_pages[ site_id ] ) {
				has_visited = true;

				AstraSitesAdmin.templateData = AstraSitesAdmin.visited_sites_and_pages[ site_id ];

				AstraSitesAdmin.process_site_data( AstraSitesAdmin.templateData );
			}

			if( false === has_visited ) {
				AstraSitesAPI._api_single_request( api_post, function( data ) {
					AstraSitesAdmin.visited_sites_and_pages[ data.id ] = data;

					AstraSitesAdmin.templateData = data;

					AstraSitesAdmin.process_site_data( AstraSitesAdmin.templateData );
				} );
			}

		},

		show_page_popup: function( page_id, site_id ) {

			$('.astra-sites-result-preview')
				.removeClass('astra-sites-get-agency-bundle astra-sites-site-import-popup astra-sites-page-import-popup')
				.addClass('preview-page-from-search-result')
				.show();

			$('.astra-sites-result-preview').html( wp.template( 'astra-sites-result-preview' ) ).addClass('preparing');
			$('.astra-sites-import-content').append( '<div class="astra-loading-wrap"><div class="astra-loading-icon"></div></div>' );

			// .attr('data-slug', 'site-pages');
			AstraSitesAdmin.action_slug = 'site-pages';
			astraSitesVars.cpt_slug = 'site-pages';

			var single_site = astraSitesVars.default_page_builder_sites[ site_id ] || '';
			var single_site_pages = single_site['pages'] || '';
			var single_page = single_site_pages[page_id] || '';

			// AstraSitesAdmin.templateData
			// Add Params for API request.
			AstraSitesAdmin._api_params = {};

			AstraSitesAdmin._apiAddParam_status();
			// AstraSitesAdmin._apiAddParam_search();
			AstraSitesAdmin._apiAddParam_per_page();
			AstraSitesAdmin._apiAddParam_astra_site_category();
			// AstraSitesAdmin._apiAddParam_page();
			AstraSitesAdmin._apiAddParam_astra_site_page_builder();
			AstraSitesAdmin._apiAddParam_astra_page_parent_category();
			AstraSitesAdmin._apiAddParam_site_url();
			AstraSitesAdmin._apiAddParam_purchase_key();
			var api_post = {
				id: astraSitesVars.cpt_slug,
				slug: astraSitesVars.cpt_slug + '/' + page_id + '?' + decodeURIComponent( $.param( AstraSitesAdmin._api_params ) ),
			};

			var has_visited = false;
			if( AstraSitesAdmin.visited_sites_and_pages[ page_id ] ) {
				has_visited = true;

				AstraSitesAdmin.templateData = AstraSitesAdmin.visited_sites_and_pages[ page_id ];

				AstraSitesAdmin.required_plugins_list_markup( AstraSitesAdmin.templateData['site-pages-required-plugins'] );
			}

			if( false === has_visited ) {
				AstraSitesAPI._api_single_request( api_post, function( data ) {
					AstraSitesAdmin.visited_sites_and_pages[ data.id ] = data;

					AstraSitesAdmin.templateData = data;

					AstraSitesAdmin.required_plugins_list_markup( AstraSitesAdmin.templateData['site-pages-required-plugins'] );
				} );
			}

		},

		show_page_popup_from_search: function(event) {
			event.preventDefault();
			var page_id = $( this ).parents( '.astra-theme' ).attr( 'data-page-id') || '';
			var site_id = $( this ).parents( '.astra-theme' ).attr( 'data-site-id') || '';

			// $('.astra-sites-result-preview').show();
			$('#astra-sites').hide();
			$('#site-pages').hide();
			AstraSitesAdmin.show_pages_by_site_id( site_id, page_id );
		},

		/**
		 * Fires when a nav item is clicked.
		 *
		 * @since 1.0
		 * @access private
		 * @method show_page_popup
		 */
		show_page_popup_from_sites: function(event) {
			event.preventDefault();

			if( $( this ).hasClass('updating-message') ) {
				return;
			}

			var page_id = AstraSitesAdmin._get_id( $( '#single-pages' ).find('.current_page').attr('data-page-id') ) || '';
			var site_id = AstraSitesAdmin._get_id( $('#site-pages').attr( 'data-site-id') ) || '';

			AstraSitesAdmin.show_page_popup( page_id, site_id );
		},

		// Returns if a value is an array
		_isArray: function(value) {
			return value && typeof value === 'object' && value.constructor === Array;
		},

		required_plugins_list_markup: function( requiredPlugins ) {

			// var requiredPlugins = AstraSitesAdmin.templateData['required_plugins'] || '';

			if( '' === requiredPlugins ) {
				return;
			}

			// or
			var $pluginsFilter  = $( '#plugin-filter' );

			// Add disabled class from import button.
			$('.astra-demo-import')
				.addClass('disabled not-click-able')
				.removeAttr('data-import');

			$('.required-plugins').addClass('loading').html('<span class="spinner is-active"></span>');

		 	// Required Required.
			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				data : {
					action           : 'astra-required-plugins',
					_ajax_nonce      : astraSitesVars._ajax_nonce,
					required_plugins : requiredPlugins
				},
			})
			.fail(function( jqXHR ){

				// Remove loader.
				$('.required-plugins').removeClass('loading').html('');

			})
			.done(function ( response ) {
				required_plugins = response.data['required_plugins'];				

				if( response.data['third_party_required_plugins'].length ) {
					$('.astra-demo-import').removeClass('button-primary').addClass('disabled');

					$('.astra-sites-third-party-required-plugins-wrap').remove();
					var template = wp.template('astra-sites-third-party-required-plugins');
					$('.astra-sites-advanced-options-wrap .astra-sites-advanced-options').hide();
					$('.astra-sites-advanced-options-wrap').append( template( response.data['third_party_required_plugins'] ) );

					// Release disabled class from import button.
					$('.astra-demo-import').addClass('button-primary').hide();
					$('.astra-sites-result-preview').addClass('skip-plugins');
					$('.astra-sites-skip-and-import').show();
				}
				
				// Release disabled class from import button.
				$('.astra-demo-import')
					.removeClass('disabled not-click-able')
					.attr('data-import', 'disabled');

				// Remove loader.
				$('.required-plugins').removeClass('loading').html('');
				$('.required-plugins-list').html('');

				var output = '';

				/**
				 * Count remaining plugins.
				 * @type number
				 */
				var remaining_plugins = 0;
				var required_plugins_markup = '';


				/**
				 * Not Installed
				 *
				 * List of not installed required plugins.
				 */
				if ( typeof required_plugins.notinstalled !== 'undefined' ) {

					// Add not have installed plugins count.
					remaining_plugins += parseInt( required_plugins.notinstalled.length );

					$( required_plugins.notinstalled ).each(function( index, plugin ) {
						output += '<li class="plugin-card plugin-card-'+plugin.slug+'" data-slug="'+plugin.slug+'" data-init="'+plugin.init+'" data-name="'+plugin.name+'">'+plugin.name+'</li>';
					});
				}

				/**
				 * Inactive
				 *
				 * List of not inactive required plugins.
				 */
				if ( typeof required_plugins.inactive !== 'undefined' ) {

					// Add inactive plugins count.
					remaining_plugins += parseInt( required_plugins.inactive.length );

					$( required_plugins.inactive ).each(function( index, plugin ) {
						output += '<li class="plugin-card plugin-card-'+plugin.slug+'" data-slug="'+plugin.slug+'" data-init="'+plugin.init+'" data-name="'+plugin.name+'">'+plugin.name+'</li>';
					});
				}

				/**
				 * Active
				 *
				 * List of not active required plugins.
				 */
				if ( typeof required_plugins.active !== 'undefined' ) {

					$( required_plugins.active ).each(function( index, plugin ) {
						output += '<li class="plugin-card plugin-card-'+plugin.slug+'" data-slug="'+plugin.slug+'" data-init="'+plugin.init+'" data-name="'+plugin.name+'">'+plugin.name+'</li>';
					});
				}

				$('.astra-sites-result-preview').find('.required-plugins-list').html( output );

				/**
				 * Enable Demo Import Button
				 * @type number
				 */
				astraSitesVars.requiredPlugins = required_plugins;

				$('.astra-sites-import-content').find( '.astra-loading-wrap' ).remove();
				$('.astra-sites-result-preview').removeClass('preparing');

				// Avoid plugin activation, for pages only.
				if( 'site-pages' === AstraSitesAdmin.action_slug ) {
					console.log( astraSitesVars.requiredPlugins );

					var notinstalled = astraSitesVars.requiredPlugins.notinstalled || 0;
					if( ! notinstalled.length ) {
						AstraSitesAdmin.import_page_process();
					}
				}
			});
		},

		import_page_process: function() {
			if( $( '.astra-sites-page-import-popup .site-install-site-button, .preview-page-from-search-result .site-install-site-button' ).hasClass('updating-message') ) {
				return;
			}

			$( '.astra-sites-page-import-popup .site-install-site-button, .preview-page-from-search-result .site-install-site-button' ).addClass('updating-message installing').text( 'Importing..' );
	
			AstraSitesAdmin.import_start_time = new Date();

			$('.astra-sites-result-preview .inner > h2').text('We\'re importing your website.');
			$('.install-theme-info').hide();
			$('.ast-importing-wrap').show();
			var output = '<div class="current-importing-status-title"></div><div class="current-importing-status-description"></div>';
			$('.current-importing-status').html( output );

			// Process Bulk Plugin Install & Activate.
			AstraSitesAdmin._bulkPluginInstallActivate();
		},

		_close_popup_by_overlay: function(event) {
			if ( this === event.target ) {
				// Import process is started?
				// And Closing the window? Then showing the warning confirm message.
				if( $('body').hasClass('importing-site') && ! confirm( astraSitesVars.strings.warningBeforeCloseWindow ) ) {
					return;
				}

				$('body').removeClass('importing-site');
				$('html').removeClass('astra-site-preview-on');

				AstraSitesAdmin._clean_url_params( 'astra-site' );
				AstraSitesAdmin._clean_url_params( 'astra-page' );
				AstraSitesAdmin._close_popup();
			}
		},

		/**
		 * Close Popup
		 *
		 * @since 1.0
		 * @access private
		 * @method _importDemo
		 */
		_close_popup: function() {
			AstraSitesAdmin._clean_url_params( 'astra-site' );
			AstraSitesAdmin._clean_url_params( 'astra-page' );
			$('.astra-sites-result-preview').html('').hide();
		},

		_page_api_call() {

			// Has API data of pages.
			if ( null == AstraSitesAdmin.templateData ) {
				return;
			}

			AstraSitesAdmin.import_wpform( AstraSitesAdmin.templateData['astra-site-wpforms-path'], function( form_response ) {

				$('body').addClass('importing-site');

				// Import Page Content
				$('.current-importing-status-wrap').remove();
				$('.astra-sites-result-preview .inner > h2').text('We are importing page!');

				fetch( AstraSitesAdmin.templateData['astra-page-api-url'] ).then(response => {
					return response.json();
				}).then(data => {

					// Work with JSON page here
					$.ajax({
						url: astraSitesVars.ajaxurl,
						type: 'POST',
						dataType: 'json',
						data: {
							'action' : 'astra-sites-create-page',
							'data'   : data,
						},
					})
					.fail(function( jqXHR ){
						console.log( jqXHR );
					})
					.done(function ( data ) {

						if( data.success ) {

							$('body').removeClass('importing-site');

							var	output  = '<p>Your page imported successfully! Now go ahead, customize the text, images, and design to make it yours!</p>';
								output += '<p>You can now start making changes according to your requirements.</p>';

							$('.rotating,.current-importing-status-wrap,.notice-warning').remove();

							var button = '<a class="button button-primary button-hero" href="'+data.data['link']+'" target="_blank">View Imported Template <i class="dashicons dashicons-external"></i></a>';
							$('.astra-sites-result-preview .ast-actioms-wrap').html(button);

							var heading = 'Done 🎉';
							$('.astra-sites-result-preview .inner > h2').text(heading);

						}

					});

				}).catch(err => {
					console.log( err );
				});
			});

			

		},

		import_wpform: function( wpforms_url, callback ) {

			if ( '' == wpforms_url ) {
				if( callback && typeof callback == "function"){
					callback( '' );
			    }
			    return;
			}

			$.ajax({
				url  : astraSitesVars.ajaxurl,
				type : 'POST',
				dataType: 'json',
				data : {
					action      : 'astra-sites-import-wpforms',
					wpforms_url : wpforms_url,
				},
				beforeSend: function() {
					AstraSitesAdmin._log_title( 'Importing WP Forms..' );
				},
			})
			.fail(function( jqXHR ){
				AstraSitesAdmin._log_title( jqXHR.status + ' ' + jqXHR.responseText, true );
		    })
			.done(function ( data ) {

				// 1. Fail - Import WPForms Options.
				if( false === data.success ) {
					AstraSitesAdmin._log_title( data.data );
				} else {
					if( callback && typeof callback == "function"){
						callback( data );
				    }
				}
			});
		},

		process_site_data: function( data ) {

			if( 'log_file' in data ){
				AstraSitesAdmin.log_file_url  = decodeURIComponent( data.log_file ) || '';
			}

			// 1. Pass - Request Site Import
			AstraSitesAdmin.customizer_data = JSON.stringify( data['astra-site-customizer-data'] ) || '';
			AstraSitesAdmin.wxr_url         = encodeURI( data['astra-site-wxr-path'] ) || '';
			AstraSitesAdmin.wpforms_url     = encodeURI( data['astra-site-wpforms-path'] ) || '';
			AstraSitesAdmin.cartflows_url     = encodeURI( data['astra-site-cartflows-path'] ) || '';
			AstraSitesAdmin.options_data    = JSON.stringify( data['astra-site-options-data'] ) || '';
			AstraSitesAdmin.widgets_data    = data['astra-site-widgets-data'] || '';


			// Required Plugins.
			AstraSitesAdmin.required_plugins_list_markup( data['required-plugins'] );
		},

		/**
		 * Enable Demo Import Button.
		 */
		_enable_demo_import_button: function( type ) {

			type = ( undefined !== type ) ? type : 'free';

			$('.install-theme-info .theme-details .site-description').remove();

			switch( type ) {

				case 'free':

							var notinstalled = astraSitesVars.requiredPlugins.notinstalled || 0;
							var inactive     = astraSitesVars.requiredPlugins.inactive || 0;
							if( $('.astra-sites-result-preview').hasClass('skip-plugins') ) {
								notinstalled = [];
							}

							if( notinstalled.length === inactive.length ) {
								$(document).trigger( 'astra-sites-after-'+AstraSitesAdmin.action_slug+'-required-plugins' );
							}
					break;

				case 'upgrade':
							var demo_slug = $('.wp-full-overlay-header').attr('data-demo-slug');

							$('.astra-demo-import')
									.addClass('go-pro button-primary')
									.removeClass('astra-demo-import')
									.attr('target', '_blank')
									.attr('href', astraSitesVars.getUpgradeURL + demo_slug )
									.text( astraSitesVars.getUpgradeText )
									.append('<i class="dashicons dashicons-external"></i>');
					break;

				default:
							var demo_slug = $('.wp-full-overlay-header').attr('data-demo-slug');

							$('.astra-demo-import')
									.addClass('go-pro button-primary')
									.removeClass('astra-demo-import')
									.attr('target', '_blank')
									.attr('href', astraSitesVars.getProURL )
									.text( astraSitesVars.getProText )
									.append('<i class="dashicons dashicons-external"></i>');

							$('.wp-full-overlay-header').find('.go-pro').remove();

							if( false == astraSitesVars.isWhiteLabeled ) {
								if( astraSitesVars.isPro ) {
									$('.install-theme-info .theme-details').prepend( wp.template('astra-sites-pro-inactive-site-description') );
								} else {
									$('.install-theme-info .theme-details').prepend( wp.template('astra-sites-pro-site-description') );
								}
							}

					break;
			}

		},

		/**
		 * Update Page Count.
		 */

		/**
		 * Remove plugin from the queue.
		 */
		_removePluginFromQueue: function( removeItem, pluginsList ) {
			return jQuery.grep(pluginsList, function( value ) {
				return value.slug != removeItem;
			});
		}

	};

	/**
	 * Initialize AstraSitesAdmin
	 */
	$(function(){
		AstraSitesAdmin.init();
	});

})(jQuery);
