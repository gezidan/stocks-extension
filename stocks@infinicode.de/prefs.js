const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gettext = imports.gettext.domain('stocks@infinicode.de');
const _ = Gettext.gettext;
const Soup = imports.gi.Soup;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Config = imports.misc.config;
const Convenience = Me.imports.convenience;

const EXTENSIONDIR = Me.dir.get_path();

const STOCKS_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.stocks';
const STOCKS_POSITION_IN_PANEL_KEY = 'position-in-panel';
const STOCKS_SHOW_PANEL_ICON = 'show-taskwarrior-icon';
const STOCKS_SHOW_PANEL_LABEL = 'show-task-amount';
const STOCKS_USE_ALTERNATIVE_THEME = 'use-alternative-theme';
const STOCKS_SYMBOL_PAIRS = 'symbol-pairs';
const STOCKS_SYMBOL_CURRENT_QUOTES = 'symbol-current-quotes';
// const STOCKS_USE_ALTERNATIVE_THEME = 'use-alternative-theme';

let currentSymbolData = null;
let inRealize = false;
let defaultSize = [-1, -1];

const PrefsWidget = new GObject.Class({
    Name     : 'StocksExtension.Prefs.Widget',
    GTypeName: 'StocksExtensionPrefsWidget',
    Extends  : Gtk.Box,

    configWidgets: [],
    Window       : new Gtk.Builder(),

    /********** Properties ******************/

    // The names must be equal to the ID in settings.ui!
    get position_in_panel()
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.get_enum(STOCKS_POSITION_IN_PANEL_KEY);
    },

    set position_in_panel(v)
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }

        this.Settings.set_enum(STOCKS_POSITION_IN_PANEL_KEY, v);
    },

    get show_taskwarrior_icon()
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.get_boolean(STOCKS_SHOW_PANEL_ICON);
    },
    set show_taskwarrior_icon(v)
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        this.Settings.set_boolean(STOCKS_SHOW_PANEL_ICON, v);
    },
    get use_alternative_theme()
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.get_boolean(STOCKS_USE_ALTERNATIVE_THEME);
    },

    set use_alternative_theme(v)
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        this.Settings.set_boolean(STOCKS_USE_ALTERNATIVE_THEME, v);
    },

    get symbolPairs()
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.get_string(STOCKS_SYMBOL_PAIRS);
    },

    set symbolPairs(v)
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        this.Settings.set_string(STOCKS_SYMBOL_PAIRS, v);
    },

    get current_quotes()
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.get_string(STOCKS_SYMBOL_CURRENT_QUOTES);
    },

    set current_quotes(v)
    {
        if(!this.Settings)
        {
            this.loadConfig();
        }
        return this.Settings.set_string(STOCKS_SYMBOL_CURRENT_QUOTES, v);
    },

    get splittedSymbolPairs()
    {
        return this.symbolPairs.split("-&&-");
    },

    /**
     * Init function of Gtk Box
     * @param params
     * @private
     */
    _init: function(params){
        this.parent(params);

        this.initWindow();

        defaultSize = this.MainWidget.get_size_request();
        let borderWidth = this.MainWidget.get_border_width();

        defaultSize[0] += 2 * borderWidth;
        defaultSize[1] += 2 * borderWidth;

        this.MainWidget.set_size_request(-1, -1);
        this.MainWidget.set_border_width(0);

        this.evaluateValues();

        this.add(this.MainWidget);

        this.MainWidget.connect('realize', Lang.bind(this, function(){
            if(inRealize)
            {
                return;
            }
            inRealize = true;

            this.MainWidget.get_toplevel().resize(defaultSize[0], defaultSize[1]);
            inRealize = false;
        }));
    },

    initWindow: function(){
        currentSymbolData = null;

        this.Window.add_from_file(EXTENSIONDIR + "/settings.ui");

        this.MainWidget = this.Window.get_object("main-widget");

        let theObjects = this.Window.get_objects();
        for(let i in theObjects)
        {
            let name = theObjects[i].get_name ? theObjects[i].get_name() : 'dummy';

            if(this[name] !== undefined)
            {
                if(theObjects[i].class_path()[1].indexOf('GtkEntry') != -1)
                {
                    this.initEntry(theObjects[i]);
                }
                else if(theObjects[i].class_path()[1].indexOf('GtkComboBoxText') != -1)
                {
                    this.initComboBox(theObjects[i]);
                }
                else if(theObjects[i].class_path()[1].indexOf('GtkSwitch') != -1)
                {
                    this.initSwitch(theObjects[i]);
                }
                else if(theObjects[i].class_path()[1].indexOf('GtkScale') != -1)
                {
                    this.initScale(theObjects[i]);
                }


                this.configWidgets.push([theObjects[i], name]);
            }
        }

        if(Me.metadata.version !== undefined)
        {
            this.Window.get_object('version').set_label(Me.metadata.version.toString());
        }

        this.mainWidget = this.Window.get_object("prefs-notebook");
        this.treeview = this.Window.get_object("tree-treeview");
        this.liststore = this.Window.get_object("tree-liststore");
        this.createWidget = this.Window.get_object("create-symbol-widget");
        this.newName = this.Window.get_object("new-name");
        this.newSymbol = this.Window.get_object("new-symbol");

        this.editName = this.Window.get_object("edit-name");
        this.editSymbol = this.Window.get_object("edit-symbol");

        this.editWidget = this.Window.get_object("edit-symbol-widget");
        this.editName = this.Window.get_object("edit-name");
        this.editSymbol = this.Window.get_object("edit-symbol");


        // TreeView / Table Buttons
        this.Window.get_object("tree-toolbutton-add").connect("clicked", Lang.bind(this, function(){
            this.createWidget.show_all();
        }));

        this.Window.get_object("tree-toolbutton-remove").connect("clicked", Lang.bind(this, this.removeSymbol));
        this.Window.get_object("tree-toolbutton-edit").connect("clicked", Lang.bind(this, this.showEditSymbolWidget));


        // Create Widget Buttons
        this.Window.get_object("button-create-save").connect("clicked", Lang.bind(this, this.saveSymbol));
        this.Window.get_object("button-create-cancel").connect("clicked", Lang.bind(this, function(){
            this.createWidget.hide();
        }));

        // Edit Widget Buttons
        this.Window.get_object("button-edit-save").connect("clicked", Lang.bind(this, this.updateSymbol));
        this.Window.get_object("button-edit-cancel").connect("clicked", Lang.bind(this, function(){
            this.editWidget.hide();
        }));

        this.initTreeView();
    },

    /**
     * Load Config Data from file and connect change event
     */
    loadConfig: function(){
        this.Settings = Convenience.getSettings(STOCKS_SETTINGS_SCHEMA);
        this.Settings.connect("changed", Lang.bind(this, this.evaluateValues));
    },

    /**
     * initialize entry items (input boxes)
     * @param theEntry entry element
     */
    initEntry: function(theEntry){
        let name = theEntry.get_name();
        theEntry.text = this[name];
        if(this[name].length != 32)
        {
            theEntry.set_icon_from_icon_name(Gtk.PositionType.LEFT, 'dialog-warning');
        }

        theEntry.connect("notify::text", Lang.bind(this, function(){
            let key = arguments[0].text;
            this[name] = key;
            if(key.length == 32)
            {
                theEntry.set_icon_from_icon_name(Gtk.PositionType.LEFT, '');
            }
            else
            {
                theEntry.set_icon_from_icon_name(Gtk.PositionType.LEFT, 'dialog-warning');
            }
        }));
    },

    /**
     * initialize combo box items
     * @param theComboBox comboBox element
     */
    initComboBox: function(theComboBox){
        const name = theComboBox.get_name();
        theComboBox.connect("changed", Lang.bind(this, function(){
            this[name] = arguments[0].active;
        }));
    },

    /**
     * initialize boolean switches
     * @param theSwitch switch element
     */
    initSwitch: function(theSwitch){
        const name = theSwitch.get_name();

        theSwitch.connect("notify::active", Lang.bind(this, function(){
            this[name] = arguments[0].active;
        }));
    },

    /**
     * initialize scale items (range slider?)
     * @param theScale scale element
     */
    initScale: function(theScale){
        let name = theScale.get_name();
        theScale.set_value(this[name]);
        this[name + 'Timeout'] = undefined;
        theScale.connect("value-changed", Lang.bind(this, function(slider){
            if(this[name + 'Timeout'] !== undefined)
            {
                Mainloop.source_remove(this[name + 'Timeout']);
            }
            this[name + 'Timeout'] = Mainloop.timeout_add(250, Lang.bind(this, function(){
                this[name] = slider.get_value();
                return false;
            }));
        }));
    },

    /**
     * Initialize TreeView (Symbol Table)
     */
    initTreeView()
    {
        let column = new Gtk.TreeViewColumn();
        column.set_title(_("Name"));
        this.treeview.append_column(column);

        let renderer = new Gtk.CellRendererText();
        column.pack_start(renderer, null);

        column.set_cell_data_func(renderer, function(){
            arguments[1].markup = arguments[2].get_value(arguments[3], 0);
        });

        column = new Gtk.TreeViewColumn();
        column.set_title(_("Symbol (Yahoo)"));
        this.treeview.append_column(column);

        column.pack_start(renderer, null);

        column.set_cell_data_func(renderer, function(){
            arguments[1].markup = arguments[2].get_value(arguments[3], 1);
        });
    },

    /**
     * This is triggered when config has changed
     * 1. refresh the settings UI view
     * 2. synchronize config values and settings elements
     */
    evaluateValues: function(){
        this.refreshUI();

        let config = this.configWidgets;
        for(let i in config)
        {
            if(config[i][0].active != this[config[i][1]])
            {
                config[i][0].active = this[config[i][1]];
            }
        }
    },

    /**
     * this recreates the TreeView (Symbol Table)
     */
    refreshUI: function(){
        this.mainWidget = this.Window.get_object("prefs-notebook");
        this.treeview = this.Window.get_object("tree-treeview");
        this.liststore = this.Window.get_object("tree-liststore");

        this.Window.get_object("tree-toolbutton-remove").sensitive = Boolean(this.symbolPairs.length);
        this.Window.get_object("tree-toolbutton-edit").sensitive = Boolean(this.symbolPairs.length);

        if(currentSymbolData == this.symbolPairs)
        {
            return;
        }

        if(this.liststore)
        {
            this.liststore.clear();
        }

        if(this.symbolPairs.length > 0)
        {
            const symbolPairList = String(this.symbolPairs).split("-&&-");

            let current = this.liststore.get_iter_first();

            symbolPairList.forEach(symbolPair => {
                symbolPair = symbolPair.split("-§§-");

                current = this.liststore.append();
                this.liststore.set_value(current, 0, symbolPair[0]);
                this.liststore.set_value(current, 1, symbolPair[1]);
            });
        }

        currentSymbolData = this.symbolPairs;
    },

    /**
     * clear a entry input element
     */
    clearEntry: function(){
        arguments[0].set_text("");
    },

    /**
     * show edit symbol widget
     */
    showEditSymbolWidget: function(){
        const selection = this.treeview.get_selection().get_selected_rows();

        // check if a row has been selected
        if(selection === undefined || selection === null)
        {
            return;
        }

        // check if we have data (normally we should otherwise it could not be selected...)
        const selectionIndex = parseInt(selection[0][0].to_string());
        let values = this.splittedSymbolPairs;
        const selectedValue = values[selectionIndex];

        if(!selectedValue)
        {
            return;
        }

        let symbolValues = selectedValue.split("-§§-");

        this.editName.set_text(symbolValues[0]);
        this.editSymbol.set_text(symbolValues[1]);

        this.editWidget.show_all();
    },

    /**
     * Save new symbol
     */
    saveSymbol: function(){
        let name = this.newName.get_text();
        let symbol = this.newSymbol.get_text().replace(/ /g, '');

        // append new item and write it to config
        this.symbolPairs = this.symbolPairs ? this.symbolPairs + "-&&-" + name + "-§§-" + symbol : name + "-§§-" + symbol;

        this.createWidget.hide();
    },

    /**
     * update existing symbol
     */
    updateSymbol: function(){
        const selection = this.treeview.get_selection().get_selected_rows();

        // check if a row has been selected
        if(selection === undefined || selection === null)
        {
            return;
        }

        // check if we have data (normally we should otherwise it could not be selected...)
        const selectionIndex = parseInt(selection[0][0].to_string());
        let values = this.splittedSymbolPairs;
        const selectedValue = values[selectionIndex];

        if(!selectedValue)
        {
            return;
        }

        // set new data and write it to config
        values[selectionIndex] = this.editName.get_text() + "-§§-" + this.editSymbol.get_text().replace(/ /g, '');
        this.symbolPairs = values.join("-&&-");

        this.editWidget.hide();
    },

    /**
     * Remove existing symbol
     */
    removeSymbol: function(){
        const selection = this.treeview.get_selection().get_selected_rows();

        // check if a row has been selected
        if(selection === undefined || selection === null)
        {
            return;
        }

        // check if we have data (normally we should otherwise it could not be selected...)
        const selectionIndex = parseInt(selection[0][0].to_string());
        let values = this.splittedSymbolPairs;
        const selectedValue = values[selectionIndex];

        if(!selectedValue)
        {
            return;
        }

        // show confirm dialog
        let [name, symbol] = selectedValue.split("-§§-");

        let textDialog = _("Remove %s ?").format(name);
        let dialog = new Gtk.Dialog({
            title: ""
        });

        let label = new Gtk.Label({
            label: textDialog
        });

        label.margin_bottom = 12;

        dialog.set_border_width(12);
        dialog.set_modal(1);
        dialog.set_resizable(0);
        //dialog.set_transient_for(***** Need parent Window *****);

        dialog.add_button(Gtk.STOCK_NO, 0);
        let d = dialog.add_button(Gtk.STOCK_YES, 1);

        d.set_can_default(true);
        dialog.set_default(d);

        let dialog_area = dialog.get_content_area();
        dialog_area.pack_start(label, 0, 0, 0);
        dialog.connect("response", Lang.bind(this, function(w, response_id){
            if(response_id)
            {
                var currentQuotes = {};

                try
                {
                    currentQuotes = JSON.parse(this.current_quotes || '{}');
                }
                catch(e)
                {
                    log("Could not parse quotes from settings");
                }

                delete currentQuotes[symbol];

                this.current_quotes = JSON.stringify(currentQuotes);

                // remove entry and write to config
                values.splice(selectionIndex, 1);
                this.symbolPairs = values.join("-&&-");
            }
            dialog.hide();
            return 0;
        }));

        dialog.show_all();
    },
});

function init()
{
    Convenience.initTranslations('stocks@infinicode.de');
}

function buildPrefsWidget()
{
    let widget = new PrefsWidget();
    widget.show_all();
    return widget;
}
