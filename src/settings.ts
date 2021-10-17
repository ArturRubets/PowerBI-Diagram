"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
  public barChart: BarChartSettings = new BarChartSettings();
}

export class BarChartSettings {
  enableAxisX: {
    show: boolean;
    fontSize: number;
  };

  enableAxisY: {
    show: boolean;
    label:boolean;
    fontSize: number;
    fontSizeLabel:number;
    labelText:string;
    line:boolean;
  };

  generalView: {
    dataOnBar:boolean;
    enableGradient:boolean;
    fontSizeDataOnBar:number;
  };

  title: {
    text: string;
    hide:boolean;
    fontSizeTitle:number;
  };

  selectionData:{
    fontSize:number;
    enable:boolean;
  }
}