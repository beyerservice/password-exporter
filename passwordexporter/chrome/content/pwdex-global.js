/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Password Exporter
 *
 * The Initial Developer of the Original Code is
 *    Justin Scott <fligtar@gmail.com>.
 *
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): (none)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Password Exporter - Global
 * This file contains functions used by all flavors of Password Exporter
 */
var CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];

var passwordExporter = {
    version: '1.1', // Incrementing requires new license acceptance
    bundle: null,
    appName: null,
    linebreak: null,
    accepted: false, // whether user has accepted this version's license
    dumpDebug: false, // whether debug message should be dumped to console
    initiated: false, // whether Password Exporter has been initiated yet
    
    export: null, // export functions specific to this app version
    import: null, // import functions specific to this app version

    // Called on load and on privacy pref tab load to create the tab overlay because the <tabs> we need doesn't have an ID
    init: function() {
        this.checkDebug();
        this.bundle = srGetStrBundle("chrome://passwordexporter/locale/passwordexporter.properties");
        this.linebreak = this.getLinebreak();
        this.appName = Application.name;
        
        this.debug('App: ' + this.appName);
        
        // Include import/export functions
        this.export = passwordExporterLoginMgr.export;
        this.import = passwordExporterLoginMgr.import;
        
        this.initiated = true;
        
        // If we are in the Password Exporter dialog, we don't need to add any buttons
        if (document.getElementById('pwdex-dialog'))
            return;
        
        // Set up UI
        var hbox;
        if (this.appName == 'Thunderbird' && document.getElementById('MailPreferences')) {
            // Thunderbird
            this.uiVersion = 4;
            if (document.getElementById('securityPrefs')) {
                this.debug('Security pane showing');
                hbox = document.getElementById('securityPrefs').getElementsByTagName('tabpanel')[3].getElementsByTagName('hbox')[0];
            }
            else {
                document.getElementById('paneSecurity').addEventListener('paneload',  function(e) { passwordExporter.init(); }, false);
                this.debug('Security pane not showing; listener added');
            }
        }
        else if (this.appName == 'Firefox') {
            // If the relevant pane is already showing, we can add the button now
            // Otherwise, we add a listener so we know when it is showing
            
            if (document.getElementById('showPasswordsBox')) {
                this.debug('Security pane showing');
                hbox = document.getElementById('showPasswordsBox');
            }
            else if (document.getElementById('paneSecurity')) {
                document.getElementById('paneSecurity').addEventListener('paneload',  function(e) { passwordExporter.init(); }, false);
                this.debug('Security pane not showing; listener added');
            }
        }
        
        // Add the button
        if (hbox) {
            var button = document.createElement('button');
            button.setAttribute('label', this.bundle.GetStringFromName('passwordexporter.button-label'));
            button.setAttribute('id', 'pwdex-button');
            button.setAttribute('accesskey', this.bundle.GetStringFromName('passwordexporter.button-accesskey'));
            button.addEventListener('command',  function(e) { passwordExporter.openWindow(); }, false);
            hbox.appendChild(button);
        }
    },
    
    // opens passwordmanager.xul to view passwords.. called from button on pwdexDialog.xul only
    viewPasswords: function() {
        // using window.open, doing certain things will cause firefox to minimize completely when the window is closed
        // hence using window.opener.open
        if (this.appName == 'SeaMonkey')
            window.opener.openDialog("chrome://communicator/content/passwordManager.xul", "", "chrome,resizable,centerscreen,maximize=no");
        else
            window.opener.open("chrome://passwordmgr/content/passwordManager.xul", "", "chrome,resizable,centerscreen,maximize=no");
    },
    
    // opens pwdexDialog.xul from privacy/security tab button in preferences
    openWindow: function() {
        var pwdexDiag = window.openDialog("chrome://passwordexporter/content/pwdexDialog.xul", "","chrome,resizable,centerscreen,close=no,modal");
        pwdexDiag.focus();
    },
    
    // checks to see if user has accepted notice for this version and if not, shows window
    checkAgreement: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
        
        if (prefs.getPrefType('extensions.passwordexporter.agreeVersion') == prefs.PREF_STRING) {
            if (this.version == prefs.getCharPref('extensions.passwordexporter.agreeVersion')) {
                this.accepted = true;
                return true;
            }
        }
        
        prefs = null;
        
        window.openDialog("chrome://passwordexporter/content/firstrunDialog.xul", "","chrome,resizable,centerscreen,close=no,modal");
        return false;
    },
    
    // write pref showing agreement to notice
    setAgreement: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
        
        prefs.setCharPref('extensions.passwordexporter.agreeVersion', this.version);
        this.accepted = true;
    },
   
    // returns the linebreak for the system doing the exporting
    getLinebreak: function() {
        if (/win/i.test(navigator.platform))
            return '\r\n';
        else if (/mac/i.test(navigator.platform))
            return '\r';
        else
            return '\n';	
    },
    
    // Disables all buttons during an import/export
    disableAllButtons: function() {
        document.getElementById('pwdex-import-btn').disabled = true;
        document.getElementById('pwdex-export-btn').disabled = true;
        document.getElementById('pwdex-import-never-btn').disabled = true;
        document.getElementById('pwdex-export-never-btn').disabled = true;
        document.getElementById('pwdex-encrypt').disabled = true;
        document.getElementById('pwdex-view-passwords').disabled = true;
        document.getElementById('pwdex-close').disabled = true;
    },
    
    // Re-enables all buttons
    enableAllButtons: function() {
        document.getElementById('pwdex-import-btn').disabled = false;
        document.getElementById('pwdex-export-btn').disabled = false;
        document.getElementById('pwdex-import-never-btn').disabled = false;
        document.getElementById('pwdex-export-never-btn').disabled = false;
        document.getElementById('pwdex-encrypt').disabled = false;
        document.getElementById('pwdex-view-passwords').disabled = false;
        document.getElementById('pwdex-close').disabled = false;
    },
    
    // returns current date in YYYY-MM-DD format for default file names
    getDateString: function() {
        var date = new Date();
        
        return date.getFullYear() + '-' + this.leadingZero(date.getMonth() + 1) + '-' + this.leadingZero(date.getDate());
    },

    // returns a number with leading zero
    leadingZero: function(number) {
        return (number < 10 ? '0' + number : number);
    },
    
    // checks preference for debug output
    checkDebug: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService).getBranch("");
        
        if (prefs.getPrefType('extensions.passwordexporter.debug') == prefs.PREF_BOOL) {
            if (true == prefs.getBoolPref('extensions.passwordexporter.debug'))
                this.dumpDebug = true;
        }
        
        prefs = null;
    },
    
    // Dumps debug text if pref set
    debug: function(text) {
        if (this.dumpDebug)
            dump('Password Exporter ' + this.version + ': ' + text + "\n");
    }
};

window.addEventListener("load",  function(e) { if (!passwordExporter.initiated) passwordExporter.init(); }, false);