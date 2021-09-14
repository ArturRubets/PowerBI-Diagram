"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
  public barChart: BarChartSettings = new BarChartSettings();
}

// export class dataPointSettings {
//   // Default color
//   public defaultColor: string = "";
//   // Show all
//   public showAllDataPoints: boolean = true;
//   // Fill
//   public fill: string = "";
//   // Color saturation
//   public fillRule: string = "";
//   // Text Size
//   public fontSize: number = 12;
// }

export class BarChartSettings {
  enableAxis: {
    show: boolean;
    fill: string;
  };

  generalView: {
    opacity: number;
  };
}