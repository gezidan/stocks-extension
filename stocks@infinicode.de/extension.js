/* jshint esnext:true */
/*
 *
 *  GNOME Shell Extension for the great Taskwarrior application
 *  - Displays pending Tasks.
 *  - adding / modifieing tasks.
 *
 * Copyright (C) 2018
 *     Florijan Hamzic <florijanh@gmail.com> @ infinicode.de
 *
 * This file is part of gnome-shell-extension-stocks.
 *
 * gnome-shell-extension-stocks is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * gnome-shell-extension-stocks is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-stocks.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const UiHelper = Me.imports.uiHelper;
const financeService = Me.imports.yahooFinanceService;
const Prefs = Me.imports.prefs;
const FinanceService = financeService.YahooFinanceService;

const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('stocks@infinicode.de');
const _ = Gettext.gettext;
const ngettext = Gettext.ngettext;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// Settings
const STOCKS_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.stocks';
const STOCKS_DESKTOP_INTERFACE = 'org.gnome.desktop.interface';
const STOCKS_POSITION_IN_PANEL_KEY = 'position-in-panel';

const MenuPosition = {
    CENTER: 0,
    RIGHT : 1,
    LEFT  : 2
};

const DisplayType = {
    ICON_AND_TEXT: 0,
    ICON         : 1,
    TEXT         : 2
};

const symbolControlMapping = {};

let _cacheExpirationTime;
const _cacheDurationInSeconds = 900;
let currentDisplayIndex = 0;

let _isOpen = false;


const HeaderBar = new Lang.Class({
    Name   : 'HeaderBar',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(menu){
        this.menu = menu;
        this.actor = new St.BoxLayout({
            style_class: this.menu._use_alternative_theme ? "headerBar dark" : "headerBar",
            vertical   : false
        });

        this.actor.add(this._createLeftBoxMenu(), {expand: true, x_fill: true, x_align: St.Align.START});
        this.actor.add(this._createMiddleBoxMenu(), {expand: true, x_fill: true, x_align: St.Align.MIDDLE});
        this.actor.add(this._createRightBoxMenu(), {expand: false, x_fill: true, x_align: St.Align.END});
    },

    _createLeftBoxMenu: function(){
        const leftBox = new St.BoxLayout({
            style_class: "leftBox"
        });

        // let activeClass = financeService.SortOrder.DUE == this.menu._sort_order ? "active" : "";
        // let addIcon = UiHelper.createActionButton("sort_time", "hatt3", activeClass, Lang.bind(this, this._toggleSortIcon));
        // addIcon.SortID = financeService.SortOrder.DUE;
        // rightBox.add(addIcon, {expand: false, x_fill: false, x_align: St.Align.END});
        //
        // activeClass = financeService.SortOrder.URGENCY == this.menu._sort_order ? "active" : "";
        // let reloadIcon = UiHelper.createActionButton("sort_priority", "hatt4", "last " + activeClass, Lang.bind(this, this._toggleSortIcon));
        // reloadIcon.SortID = financeService.SortOrder.URGENCY;
        // rightBox.add(reloadIcon, {expand: false, x_fill: false, x_align: St.Align.END});

        // leftBox.add(UiHelper.createActionButton("create", "hatt", null, Lang.bind(this.menu, function () {
        //     this._openTaskCreationDialog();
        // })));

        return leftBox;
    },

    _createMiddleBoxMenu: function(){
        const middleBox = new St.BoxLayout({
            style_class: "middleBox"
        });

        // let activeClass = financeService.TaskType.ACTIVE == _currentTaskType ? "active" : "";
        // var activeButton = UiHelper.createActionButton("task_open", "hatt3", "activeButton " + activeClass, Lang.bind(this, this._toggleTaskType));
        // activeButton.TypeID = financeService.TaskType.ACTIVE;
        //
        // activeClass = financeService.TaskType.COMPLETED == _currentTaskType ? "active" : "";
        // var closedButton = UiHelper.createActionButton("task_done", "hatt3", "completedButton last " + activeClass, Lang.bind(this, this._toggleTaskType));
        // closedButton.TypeID = financeService.TaskType.COMPLETED;
        //
        // middleBox.add(activeButton);
        // middleBox.add(closedButton);

        return middleBox;
    },

    _createRightBoxMenu: function(){
        const box = new St.BoxLayout({style_class: "rightBox"});

        box.add(UiHelper.createActionButton("refresh", "hatt2", null, Lang.bind(this.menu, function(){
            this.quoteBox.reloadQuoteData(true);
        })));

        box.add(UiHelper.createActionButton("settings", "hatt2", "last", Lang.bind(this.menu, function(){
            this.menu.actor.hide();
            this.actor.hide();
            this.actor.show();
            Util.spawn(["gnome-shell-extension-prefs", "stocks@infinicode.de"]);
        })));

        return box;
    },

    // _toggleSortIcon: function (button) {
    //     // skip because it is already active
    //     if (this.menu._sort_order == button.SortID) {
    //         return;
    //     }
    //
    //     // first remove active classes then highlight the clicked button
    //     let tabBox = button.get_parent();
    //     let tabBoxChildren = tabBox.get_children();
    //
    //     for (let i = 0; i < tabBoxChildren.length; i++) {
    //         let tabButton = tabBoxChildren[i];
    //         tabButton.remove_style_class_name("active");
    //     }
    //
    //     button.add_style_class_name("active");
    //     this.menu._sort_order = button.SortID;
    //
    //     // clear box and fetch new data
    //     this.menu.taskBox.reloadQuoteData(true);
    // },
    //
    // _toggleTaskType: function (button) {
    //     // skip because it is already active
    //     if (_currentTaskType == button.TypeID) {
    //         return;
    //     }
    //
    //     // first remove active classes then highlight the clicked button
    //     let tabBox = button.get_parent();
    //     let tabBoxChildren = tabBox.get_children();
    //
    //     for (let i = 0; i < tabBoxChildren.length; i++) {
    //         let tabButton = tabBoxChildren[i];
    //         tabButton.remove_style_class_name("active");
    //     }
    //
    //     button.add_style_class_name("active");
    //     _currentTaskType = button.TypeID;
    //
    //     // reset also currentProjectName
    //     _currentProjectName = undefined;
    //
    //     // clear box and fetch new data
    //     this.menu.taskBox.reloadQuoteData(true);
    // }
});

const ScrollBox = new Lang.Class({
    Name   : 'ScrollBox',
    Extends: PopupMenu.PopupMenuBase,

    _init: function(menu, styleClass){
        this.menu = menu;

        this.box = new St.BoxLayout({
            style_class: styleClass,
            vertical   : true
        });

        this.actor = new St.ScrollView({
            style_class       : 'scrollBox',
            hscrollbar_policy : Gtk.PolicyType.NEVER,
            vscrollbar_policy : Gtk.PolicyType.NEVER,
            overlay_scrollbars: true
        });

        this.actor.add_actor(this.box);

        this.reloadQuoteData(true);

        this.renderRows();
    },

    addGridItem: function(quote){
        if(!quote)
        {
            return;
        }

        const description = quote.Name;

        let rawChangeValue = null;
        let additionalRowClass = "";
        let formattedDate = null;

        if(quote.PreviousClose && quote.Close)
        {
            rawChangeValue = (quote.Close / quote.PreviousClose) * 100 - 100;
        }

        if(rawChangeValue > 0)
        {
            additionalRowClass = "positiv";
        }
        else if(rawChangeValue < 0)
        {
            additionalRowClass = "negative";
        }

        if(quote.Timestamp)
        {
            formattedDate = Convenience.formatDate(new Date(quote.Timestamp * 1000), N_("H:N:S D.M.Y"));
        }

        let closeRowBox, nameRowValueLabel, closeRowValueLabel, changeRowBox, changeRowValueLabel,
            previousCloseRowValueLabel, openRowValueLabel, lowRowValueLabel, highRowValueLabel,
            volumeRowValueLabel, timestampRowValueLabel, exchangeNameRowValueLabel;

        const gridMenu = new PopupMenu.PopupSubMenuMenuItem(description, true);

        // Label
        const _quoteLabel = new St.Label({
            style_class: 'quoteLabel',
            text       : _('n/a')
        });

        // Label
        const _quoteInformationLabel = new St.Label({
            style_class: 'quoteInformationLabel',
            text       : _('n/a')
        });

        const _quoteInformationBox = new St.BoxLayout({
            style_class: 'quoteInformationBox ' + additionalRowClass,
            y_align    : Clutter.ActorAlign.CENTER,
            vertical   : true
        });

        _quoteInformationBox.add(_quoteLabel, {expand: true, x_fill: true, x_align: St.Align.MIDDLE});
        _quoteInformationBox.add(_quoteInformationLabel, {expand: true, x_fill: true, x_align: St.Align.MIDDLE});

        gridMenu.actor.insert_child_at_index(_quoteInformationBox, 4);
        gridMenu.actor.add_style_class_name("taskGrid");

        gridMenu.menu.box.add_style_class_name("taskGridInner");
        gridMenu.menu._needsScrollbar = function(){
            return false;
        };

        if(formattedDate)
        {
            _quoteInformationLabel.text = formattedDate;
        }

        this._appendDataRow(gridMenu, _("Symbol:"), quote.Symbol || "-");

        if(quote.FullName)
        {
            [closeRowBox, , nameRowValueLabel] = this._appendDataRow(gridMenu, _("Name:"), quote.FullName);
        }
        else
        {
            [closeRowBox, , nameRowValueLabel] = this._appendDataRow(gridMenu, _("Name:"), "-");
        }

        if(quote.Close)
        {
            const close = Convenience.format_price(quote.Close, quote.CurrencySymbol);
            [closeRowBox, , closeRowValueLabel] = this._appendDataRow(gridMenu, _("Close:"), close, additionalRowClass);
            _quoteLabel.text = close;
        }
        else
        {
            [closeRowBox, , closeRowValueLabel] = this._appendDataRow(gridMenu, _("Close:"), "-");
        }

        if(quote.PreviousClose)
        {
            [, , previousCloseRowValueLabel] = this._appendDataRow(gridMenu, _("Previous Close:"), Convenience.format_price(quote.PreviousClose, quote.CurrencySymbol));
        }
        else
        {
            [, , previousCloseRowValueLabel] = this._appendDataRow(gridMenu, _("Previous Close:"), "-");
        }

        if(rawChangeValue != null)
        {
            const formattedChange = (Convenience.round(rawChangeValue, 2)) + " %";
            [changeRowBox, , changeRowValueLabel] = this._appendDataRow(gridMenu, _("Change:"), formattedChange, additionalRowClass);
            _quoteLabel.text += " (" + formattedChange + ")";
        }
        else
        {
            [changeRowBox, , changeRowValueLabel] = this._appendDataRow(gridMenu, _("Change:"), "-");
        }

        if(quote.Open)
        {
            [, , openRowValueLabel] = this._appendDataRow(gridMenu, _("Open:"), Convenience.format_price(quote.Open, quote.CurrencySymbol));
        }
        else
        {
            [, , openRowValueLabel] = this._appendDataRow(gridMenu, _("Open:"), "-");
        }

        if(quote.Low)
        {
            [, , lowRowValueLabel] = this._appendDataRow(gridMenu, _("Low:"), Convenience.format_price(quote.Low, quote.CurrencySymbol));
        }
        else
        {
            [, , lowRowValueLabel] = this._appendDataRow(gridMenu, _("Low:"), "-");
        }

        if(quote.High)
        {
            [, , highRowValueLabel] = this._appendDataRow(gridMenu, _("High:"), Convenience.format_price(quote.High, quote.CurrencySymbol));
        }
        else
        {
            [, , highRowValueLabel] = this._appendDataRow(gridMenu, _("High:"), "-");
        }

        if(quote.ExchangeName)
        {
            [, , exchangeNameRowValueLabel] = this._appendDataRow(gridMenu, _("Exchange:"), quote.ExchangeName);
            _quoteInformationLabel.text = quote.ExchangeName + " | " + _quoteInformationLabel.text;
        }
        else
        {
            [, , exchangeNameRowValueLabel] = this._appendDataRow(gridMenu, _("Exchange:"), "-");
        }

        if(quote.Volume)
        {
            [, , volumeRowValueLabel] = this._appendDataRow(gridMenu, _("Volume:"), quote.Volume.toString());
            _quoteInformationLabel.text = quote.Volume + " | " + _quoteInformationLabel.text;
        }
        else
        {
            [, , volumeRowValueLabel] = this._appendDataRow(gridMenu, _("Volume:"), "-");
        }

        if(formattedDate)
        {
            [, , timestampRowValueLabel] = this._appendDataRow(gridMenu, _("Timestamp:"), formattedDate);
        }
        else
        {
            [, , timestampRowValueLabel] = this._appendDataRow(gridMenu, _("Timestamp:"), "-");
        }

        symbolControlMapping[quote.Symbol] = {
            'QuoteBox'                  : _quoteInformationBox,
            'QuoteLabel'                : _quoteLabel,
            'QuoteInfoLabel'            : _quoteInformationLabel,
            'PreviousCloseRowValueLabel': previousCloseRowValueLabel,
            'CloseRowBox'               : closeRowBox,
            'CloseRowValueLabel'        : closeRowValueLabel,
            'ChangeRowBox'              : changeRowBox,
            'ChangeRowValueLabel'       : changeRowValueLabel,
            'OpenRowValueLabel'         : openRowValueLabel,
            'LowRowValueLabel'          : lowRowValueLabel,
            'HighRowValueLabel'         : highRowValueLabel,
            'VolumeRowValueLabel'       : volumeRowValueLabel,
            'TimestampRowValueLabel'    : timestampRowValueLabel,
            'ExchangeNameRowValueLabel' : exchangeNameRowValueLabel,
            'NameRowValueLabel'         : nameRowValueLabel
        };

        this.addMenuItem(gridMenu);
    },

    _setOpenedSubMenu: function(){
    },

    _appendDataRow: function(gridMenu, title, value, classes){
        const rowMenuItem = new PopupMenu.PopupBaseMenuItem({
            reactive   : false,
            style_class: 'stockRowMenuItem'
        });

        const quoteDataRow = new St.BoxLayout({
            style_class: 'stockDataRow ' + (classes || "")
        });

        const titleLabel = new St.Label({
            text       : title,
            style_class: 'rowTitle'
        });

        const valueLabel = new St.Label({
            text       : value,
            style_class: 'rowValue'
        });

        quoteDataRow.add(titleLabel, {expand: true, x_fill: false, x_align: St.Align.START});
        quoteDataRow.add(valueLabel, {expand: true, x_fill: false, x_align: St.Align.END});

        if(ExtensionUtils.versionCheck(['3.8'], Config.PACKAGE_VERSION))
        {
            rowMenuItem.add_actor(quoteDataRow);
        }
        else
        {
            rowMenuItem.actor.add_actor(quoteDataRow);
        }

        gridMenu.menu.addMenuItem(rowMenuItem);

        return [quoteDataRow, titleLabel, valueLabel];
    },

    _destroyItems: function(){
        const items = this.box.get_children();
        for(let i = 0; i < items.length; i++)
        {
            const boxItem = items[i];
            boxItem.destroy();
        }
    },

    renderRows: function(){
        const scrollBar = this.actor.get_vscroll_bar();
        if(scrollBar)
        {
            let appsScrollBoxAdj = scrollBar.get_adjustment();
            appsScrollBoxAdj.value = 0;
            scrollBar.set_adjustment(appsScrollBoxAdj);
        }

        this._destroyItems();

        var currentQuotes = {};

        try
        {
            currentQuotes = JSON.parse(this.menu._symbol_current_quotes || '{}');
        }
        catch(e)
        {
            log("Could not parse quotes from settings");
        }

        // print(JSON.stringify(currentQuotes));
        // print(JSON.stringify(previousQuotes));

        if(this.menu._symbol_pairs)
        {
            this.menu._symbol_pairs.split("-&&-").forEach(symbolPair => {
                const [name, symbol] = symbolPair.split("-§§-");
                let quote = currentQuotes[symbol] || new financeService.Quote();

                quote.Name = name.toString();
                quote.Symbol = symbol.toString();

                this.addGridItem(quote);
            });
        }
        else
        {
            this.showTextBox(_("No Data to show!\n\nAdd some symbols via settings."), "noTasks");
        }
    },

    reloadQuoteData  : function(refreshCache){
        let now = new Date().getTime() / 1000;
        if(refreshCache || !_cacheExpirationTime || _cacheExpirationTime < now)
        {
            _cacheExpirationTime = now + _cacheDurationInSeconds;

            var currentQuotes = {};

            try
            {
                currentQuotes = JSON.parse(this.menu._symbol_current_quotes || '{}');
            }
            catch(e)
            {
                log("Could not parse quotes from settings");
            }

            // print(JSON.stringify(currentQuotes));

            this.menu._symbol_pairs.split("-&&-").forEach((symbolPair, index) => {
                const [name, symbol] = symbolPair.split("-§§-");

                // delay for ¼ second to avoid hammering api
                Mainloop.timeout_add_seconds(0.250 * index, Lang.bind(this, function(){
                    this.menu.service.loadQuoteAsync(symbol, Lang.bind(this, function(quote){
                        currentQuotes[symbol] = quote;
                        this.menu._symbol_current_quotes = JSON.stringify(currentQuotes);
                        this.setNewQuoteValues(symbol, quote);
                    }));
                }));
            });
        }
    },
    setNewQuoteValues: function(symbol, quote){
        if(!quote)
        {
            return;
        }

        const elementsData = symbolControlMapping[symbol];

        if(!elementsData)
        {
            return;
        }

        let rawChangeValue = null;
        let additionalRowClass = "";
        let formattedDate = null;

        if(quote.PreviousClose && quote.Close)
        {
            rawChangeValue = ((quote.Close / quote.PreviousClose) * 100) - 100;
        }

        if(rawChangeValue > 0)
        {
            additionalRowClass = "positiv";
        }
        else if(rawChangeValue < 0)
        {
            additionalRowClass = "negative";
        }

        if(quote.Timestamp)
        {
            formattedDate = Convenience.formatDate(new Date(quote.Timestamp * 1000), N_("H:N:S D.M.Y"));
        }

        if(formattedDate)
        {
            elementsData.QuoteInfoLabel.text = formattedDate;
        }

        if(quote.FullName)
        {
            elementsData.NameRowValueLabel.text = quote.FullName;
        }

        if(quote.Close)
        {
            const close = Convenience.format_price(quote.Close, quote.CurrencySymbol);

            elementsData.QuoteBox.style_class = "quoteInformationBox " + additionalRowClass;
            elementsData.CloseRowBox.style_class = "stockDataRow " + additionalRowClass;
            elementsData.CloseRowValueLabel.text = close;
            elementsData.QuoteLabel.text = close;
        }

        if(quote.PreviousClose)
        {
            elementsData.PreviousCloseRowValueLabel.text = Convenience.format_price(quote.PreviousClose, quote.CurrencySymbol);
        }

        if(rawChangeValue != null)
        {
            const formattedChange = (Convenience.round(rawChangeValue, 2)) + " %";
            elementsData.ChangeRowValueLabel.text = formattedChange;
            elementsData.ChangeRowBox.style_class = "stockDataRow " + additionalRowClass;
            elementsData.QuoteLabel.text += " (" + formattedChange + ")";
        }

        if(quote.Open)
        {
            elementsData.OpenRowValueLabel.text = Convenience.format_price(quote.Open, quote.CurrencySymbol);
        }

        if(quote.Low)
        {
            elementsData.LowRowValueLabel.text = Convenience.format_price(quote.Low, quote.CurrencySymbol);
        }

        if(quote.High)
        {
            elementsData.HighRowValueLabel.text = Convenience.format_price(quote.High, quote.CurrencySymbol);
        }

        if(quote.ExchangeName)
        {
            elementsData.ExchangeNameRowValueLabel.text = quote.ExchangeName.toString();
            elementsData.QuoteInfoLabel.text = quote.ExchangeName + " | " + elementsData.QuoteInfoLabel.text;
        }

        if(quote.Volume)
        {
            elementsData.VolumeRowValueLabel.text = quote.Volume.toString();
            elementsData.QuoteInfoLabel.text = quote.Volume + " | " + elementsData.QuoteInfoLabel.text;
        }

        if(formattedDate)
        {
            elementsData.TimestampRowValueLabel.text = formattedDate;
        }
    },
    showTextBox      : function(message, classes){
        this._destroyItems();

        const placeholderLabel = new St.Label({
            text       : message,
            style_class: 'messageBox ' + classes || ""
        });

        placeholderLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        placeholderLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        placeholderLabel.clutter_text.line_wrap = true;

        this.box.add(placeholderLabel, {
            expand : true,
            x_fill : true,
            y_fill : true,
            y_align: St.Align.MIDDLE,
            x_align: St.Align.MIDDLE
        });
    }
});

const StocksMenuButton = new Lang.Class({
    Name: 'StocksMenuButton',

    Extends: PanelMenu.Button,

    get _position_in_panel()
    {
        return this.Settings.get_enum(Prefs.STOCKS_POSITION_IN_PANEL_KEY);
    },

    get _show_panel_label()
    {
        return 1;
    },

    get _use_alternative_theme()
    {
        return this.Settings.get_boolean(Prefs.STOCKS_USE_ALTERNATIVE_THEME);
    },

    get _symbol_pairs()
    {
        return this.Settings.get_string(Prefs.STOCKS_SYMBOL_PAIRS);
    },

    get _symbol_current_quotes()
    {
        return this.Settings.get_string(Prefs.STOCKS_SYMBOL_CURRENT_QUOTES);
    },

    set _symbol_current_quotes(v)
    {
        return this.Settings.set_string(Prefs.STOCKS_SYMBOL_CURRENT_QUOTES, v);
    },

    get Settings()
    {
        if(!this._settings)
        {
            this.loadSettings();
        }

        return this._settings;
    },

    _init: function(){
        this.switchProvider();

        // Load settings
        this.loadSettings();

        // reset data
        //this._symbol_current_quotes = "";

        // Label
        this.globalStockNameLabel = new St.Label({
            style_class: 'test2',
            text       : _('No Data')
        });

        // Label
        this.globalStockDetailsLabel = new St.Label({
            text       : _('…'),
            style_class: 'test1'
        });

        this._panelButtonLabelBox = new St.BoxLayout({
            style_class: 'globalLabelBox',
            y_align    : Clutter.ActorAlign.CENTER,
            vertical   : true
        });

        this._panelButtonLabelBox.add(this.globalStockNameLabel, {
            expand : true,
            x_fill : true,
            x_align: St.Align.MIDDLE
        });
        this._panelButtonLabelBox.add(this.globalStockDetailsLabel, {
            expand : true,
            x_fill : true,
            x_align: St.Align.MIDDLE
        });

        // Panel menu item - the current class
        let menuAlignment = 0.25;

        if(Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
        {
            menuAlignment = 1.0 - menuAlignment;
        }

        this.parent(menuAlignment);

        // Putting the panel item together
        const topBox = new St.BoxLayout();
        topBox.add_actor(this._panelButtonLabelBox);
        this.actor.add_actor(topBox);

        const dummyBox = new St.BoxLayout();
        this.actor.reparent(dummyBox);
        dummyBox.remove_actor(this.actor);
        dummyBox.destroy();

        this.actor.add_style_class_name('stocks');

        let children = null;
        this._oldPanelPosition = this._position_in_panel;
        switch(this._position_in_panel)
        {
            case MenuPosition.LEFT:
                children = Main.panel._leftBox.get_children();
                Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
                break;
            case MenuPosition.CENTER:
                children = Main.panel._centerBox.get_children();
                Main.panel._centerBox.insert_child_at_index(this.actor, children.length);
                break;
            case MenuPosition.RIGHT:
                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(this.actor, 0);
                break;
        }

        if(Main.panel._menus === undefined)
        {
            Main.panel.menuManager.addMenu(this.menu);
        }
        else
        {
            Main.panel._menus.addMenu(this.menu);
        }

        this.quoteBox = new ScrollBox(this, "");
        this._renderPanelMenuHeaderBox();

        this.actor.connect('button-press-event', Lang.bind(this, this._showNextStockInPanel));
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen){
            _isOpen = isOpen;

            if(_isOpen)
            {
                this.quoteBox.reloadQuoteData();
            }
        }));

        const section = new PopupMenu.PopupMenuSection();
        section._setOpenedSubMenu = function(){

        };
        this.menu.addMenuItem(section);

        section.actor.add_actor(this.quoteBox.actor);

        this.setRefreshQuoteDataTimeout();
        this.setToggleDisplayTimeout();

        if(ExtensionUtils.versionCheck(['3.8'], Config.PACKAGE_VERSION))
        {
            this._needsColorUpdate = true;
            let context = St.ThemeContext.get_for_stage(global.stage);
            this._globalThemeChangedId = context.connect('changed', Lang.bind(this, function(){
                this._needsColorUpdate = true;
            }));
        }

        this.checkPanelControls();
    },

    checkPanelControls: function(){
        // if (this._show_panel_label) {
        //     this._panelButtonLabel.show();
        // }
        // else {
        //     this._panelButtonLabel.hide();
        // }

        this.headerBar.actor.style_class = this._use_alternative_theme ? "headerBar dark" : "headerBar";
    },

    checkPositionInPanel: function(){
        if(this._oldPanelPosition != this._position_in_panel)
        {
            switch(this._oldPanelPosition)
            {
                case MenuPosition.LEFT:
                    Main.panel._leftBox.remove_actor(this.actor);
                    break;
                case MenuPosition.CENTER:
                    Main.panel._centerBox.remove_actor(this.actor);
                    break;
                case MenuPosition.RIGHT:
                    Main.panel._rightBox.remove_actor(this.actor);
                    break;
            }

            let children = null;
            switch(this._position_in_panel)
            {
                case MenuPosition.LEFT:
                    children = Main.panel._leftBox.get_children();
                    Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
                    break;
                case MenuPosition.CENTER:
                    children = Main.panel._centerBox.get_children();
                    Main.panel._centerBox.insert_child_at_index(this.actor, children.length);
                    break;
                case MenuPosition.RIGHT:
                    children = Main.panel._rightBox.get_children();
                    Main.panel._rightBox.insert_child_at_index(this.actor, 0);
                    break;
            }
            this._oldPanelPosition = this._position_in_panel;
        }

    },

    _renderPanelMenuHeaderBox: function(){
        this.headerBar = new HeaderBar(this);
        const section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        section.actor.add_actor(this.headerBar.actor);
    },

    loadSettings: function(){
        this._settings = Convenience.getSettings(STOCKS_SETTINGS_SCHEMA);

        this._settingsC = this._settings.connect("changed", Lang.bind(this, function(settingObject, changedKey){
            this.checkPositionInPanel();
            this.checkPanelControls();

            if(changedKey == "symbol-pairs")
            {
                this.quoteBox.renderRows();
                this.quoteBox.reloadQuoteData(true);
            }
        }));
    },

    switchProvider: function(){
        // By now only one service can be selected
        this.useYahooFinanceService();
    },

    useYahooFinanceService: function(){
        this.service = new FinanceService();
    },

    // show next stock in panel
    _showNextStockInPanel: function(actor, event){
        // left click === 1, middle click === 2, right click === 3
        const buttonID = event.get_button();

        if(buttonID === 2 || buttonID === 3)
        {
            this.menu.close();
            this.refreshGlobalPanelLabels();
            this.setToggleDisplayTimeout();
        }
    },

    setRefreshQuoteDataTimeout: function(){
        if(this._refreshQuoteDataTimeoutID)
        {
            Mainloop.source_remove(this._refreshQuoteDataTimeoutID);
            this._refreshQuoteDataTimeoutID = undefined;
        }

        this._refreshQuoteDataTimeoutID = Mainloop.timeout_add_seconds(100, Lang.bind(this, function(){
            // Avoid intervention while user is doing something
            if(!_isOpen)
            {
                this.quoteBox.reloadQuoteData();
            }

            this.setRefreshQuoteDataTimeout();
            return true;
        }));
    },

    setToggleDisplayTimeout: function(){
        if(this._toggleDisplayTimeout)
        {
            Mainloop.source_remove(this._toggleDisplayTimeout);
            this._toggleDisplayTimeout = undefined;
        }
        else
        {
            this.refreshGlobalPanelLabels();
        }

        this._toggleDisplayTimeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, function(){
                this.refreshGlobalPanelLabels();

                this.setToggleDisplayTimeout();
                return true;
            }
        ));
    },

    refreshGlobalPanelLabels: function(){
        var currentQuotes = {};

        try
        {
            currentQuotes = JSON.parse(this._symbol_current_quotes || '{}');
        }
        catch(e)
        {
            log("Could not parse quotes from settings");
        }

        const symbolData = this._symbol_pairs.split("-&&-");
        currentDisplayIndex++;

        if(currentDisplayIndex + 1 > symbolData.length)
        {
            currentDisplayIndex = 0;
        }

        const symbolPair = symbolData[currentDisplayIndex];

        if(!symbolPair)
        {
            return;
        }

        const [name, symbol] = symbolPair.split("-§§-");
        const currentQuote = currentQuotes[symbol];

        let previousPrice = null;
        let currentPrice = null;
        let rawChangeValue = null;
        let formattedChange = null;

        if(currentQuote)
        {
            if(currentQuote.Close)
            {
                currentPrice = currentQuote.Close;
            }

            if(currentQuote.PreviousClose)
            {
                previousPrice = currentQuote.PreviousClose;
            }
        }

        if(currentPrice && previousPrice)
        {
            rawChangeValue = (currentPrice / previousPrice) * 100 - 100;
            formattedChange = (Convenience.round(rawChangeValue, 2)) + " %";
        }

        this.globalStockNameLabel.text = name;

        if(!currentPrice)
        {
            this.globalStockDetailsLabel.text = "n/a";
        }
        else
        {
            this.globalStockDetailsLabel.text = Convenience.format_price(currentPrice, currentQuote.CurrencySymbol);

            if(formattedChange)
            {
                this.globalStockDetailsLabel.text += " (" + formattedChange + ")";
            }

            if(rawChangeValue > 0)
            {
                this._panelButtonLabelBox.style_class = "globalLabelBox positiv";
            }
            else if(rawChangeValue < 0)
            {
                this._panelButtonLabelBox.style_class = "globalLabelBox negative";
            }
            else
            {
                this._panelButtonLabelBox.style_class = "globalLabelBox";
            }
        }
    },

    stop: function(){
        _cacheExpirationTime = undefined;

        if(this._refreshQuoteDataTimeoutID)
        {
            Mainloop.source_remove(this._refreshQuoteDataTimeoutID);
            this._refreshQuoteDataTimeoutID = undefined;
        }
    }
});

let stocksMenu;

function init(extensionMeta)
{
    Convenience.initTranslations('stocks@infinicode.de');
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

function enable()
{
    stocksMenu = new StocksMenuButton();
    Main.panel.addToStatusArea('stocksMenu', stocksMenu);
}

function disable()
{
    stocksMenu.stop();
    stocksMenu.destroy();
}
