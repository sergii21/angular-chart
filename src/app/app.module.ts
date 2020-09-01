import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { HelloComponent } from './hello.component';
import { DonutChartComponent } from './charts/donut-chart.component';
import { D3Service } from 'd3-ng2-service';

@NgModule({
  imports:      [ BrowserModule, FormsModule ],
  declarations: [ AppComponent, HelloComponent, DonutChartComponent ],
  bootstrap:    [ AppComponent ],
  exports: [DonutChartComponent],
  providers: [D3Service]
})
export class AppModule { }
