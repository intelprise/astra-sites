<?php
/**
 * Single Page Background Process
 *
 * @package Astra Sites
 * @since x.x.x
 */

if ( class_exists( 'WP_Background_Process' ) ) :

	/**
	 * Image Background Process
	 *
	 * @since x.x.x
	 */
	class WP_Background_Process_Astra_Site_Importer extends WP_Background_Process {

		/**
		 * Image Process
		 *
		 * @var string
		 */
		protected $action = 'astra_site_importer';

		/**
		 * Task
		 *
		 * Override this method to perform any actions required on each
		 * queue item. Return the modified item for further processing
		 * in the next pass through. Or, return false to remove the
		 * item from the queue.
		 *
		 * @since x.x.x
		 *
		 * @param object $object Queue item object.
		 * @return mixed
		 */
		protected function task( $object ) {

			$process = $object['instance'];
			$method  = $object['method'];

			if ( 'import_categories' === $method ) {
				error_log( 'Importing Categories' );
				update_option( 'astra-sites-batch-status-string', 'Importing Categories' );
				$process->import_categories();
			} elseif ( 'import_sites' === $method ) {
				$page = $object['page'];

				error_log( 'Inside Batch ' . $page );
				update_option( 'astra-sites-batch-status-string', 'Inside Batch ' . $page );
				$process->import_sites( $page );
			}

			return false;
		}

		/**
		 * Complete
		 *
		 * Override if applicable, but ensure that the below actions are
		 * performed, or, call parent::complete().
		 *
		 * @since x.x.x
		 */
		protected function complete() {
			parent::complete();

			error_log( 'All processes are complete' );
			update_option( 'astra-sites-batch-status-string', 'All processes are complete' );
			delete_option( 'astra-sites-batch-status' );
		}

	}

endif;