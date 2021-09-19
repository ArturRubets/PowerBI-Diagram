"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
  public barChart: BarChartSettings = new BarChartSettings();
}

export class BarChartSettings {
  enableAxisX: {
    show: boolean;
  };

  enableAxisY: {
    show: boolean;
    label:boolean;
  };

  generalView: {
    opacity: number;
    dataOnBar:boolean;
    enableGradient:boolean;
  };

  title: {
    text: string;
    hide:boolean;
  };
}