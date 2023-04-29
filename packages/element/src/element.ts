import {render,html} from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import type { FlowyDiagram } from 'flowy-engine'
import { blockType, isBlockAlreadyLinked } from './element-utils'
import * as condition from './condition'

import './element.css'

const mode_img = new URL('../assets/more.svg', import.meta.url)
const grabme_img = new URL('../assets/grabme.svg', import.meta.url)
const logred_img = new URL('../assets/logred.svg', import.meta.url)
const databaseorange_img = new URL('../assets/databaseorange.svg', import.meta.url)
const eye_img = new URL('../assets/eye.svg', import.meta.url)
const eyeblue_img = new URL('../assets/eyeblue.svg', import.meta.url)
const action_img = new URL('../assets/action.svg', import.meta.url)
const actionblue_img = new URL('../assets/actionblue.svg', import.meta.url)
const actionorange_img = new URL('../assets/actionorange.svg', import.meta.url)
const time_img = new URL('../assets/time.svg', import.meta.url)
const timeblue_img = new URL('../assets/timeblue.svg', import.meta.url)
const error_img = new URL('../assets/error.svg', import.meta.url)
const errorblue_img = new URL('../assets/errorblue.svg', import.meta.url)
const errorred_img = new URL('../assets/errorred.svg', import.meta.url)
const database_img = new URL('../assets/database.svg', import.meta.url)
const twitter_img = new URL('../assets/twitter.svg', import.meta.url)
const twitterorange_img = new URL('../assets/twitterorange.svg', import.meta.url)
const log_img = new URL('../assets/log.svg', import.meta.url)
const close_img = new URL('../assets/close.svg', import.meta.url)
const dropdown_img = new URL('../assets/dropdown.svg', import.meta.url)
const checkon_img = new URL('../assets/checkon.svg', import.meta.url)
const checkoff_img = new URL('../assets/checkoff.svg', import.meta.url)


export function initElement( diagram:FlowyDiagram, templates_container:HTMLElement, properties_container:HTMLElement ) {

    diagram.addEventListener( 'templateGrabbed', (e) =>  {
        e.detail.classList.add('blockdisabled')
    }, false )
    
    diagram.addEventListener( 'templateReleased', (e) => { 
        e.detail.classList.remove("blockdisabled") 
    }, false)

    diagram.addEventListener( 'sheetClosed', (e) =>  {
        e.detail.classList.remove('selectedblock')

        properties_container.querySelector("#properties")?.classList.remove("expanded")
    }, true )

    diagram.addEventListener( 'blockSelected', e => {
        // GUARD
        if( diagram.querySelector( ".selectedblock" ) !== null ) return 

        e.detail.classList.add( 'selectedblock')

        _addPropertiesSheet( diagram, properties_container, e.detail  )

        properties_container.querySelector("#properties")?.classList.add("expanded")

    }, false )

    diagram.addEventListener( 'snapping', e => {

        const { target, parent } = e.detail

        if( !addElement( diagram, target, parent ) ) {
            e.preventDefault()
            return
        }
        

    }, false )

    diagram.addEventListener( 'moving', e => {

        const { target:id } = e.detail

        if( isBlockAlreadyLinked( diagram, id ) ) {
            e.preventDefault()
        }

    }, false )

    _addTemplates( templates_container )


}


const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    switch( blockType(target) ) {
        case "1":
            return _addElement( diagram, target, parent ?? null, eyeblue_img, 'New visitor', 'When a <span>new visitor</span> goes to <span>Site 1</span>')
        case "2" :
            return _addElement( diagram, target, parent ?? null, actionblue_img, 'Action is performed', 'When <span>Action 1</span> is performed')
        case "3":
            return _addElement( diagram, target, parent ?? null, timeblue_img, 'Time has passed', 'When <span>10 seconds</span> have passed</div>')
        case "4":
            return _addElement( diagram, target, parent ?? null, errorblue_img, 'Error prompt', 'When <span>Error 1</span> is triggered</div>')
        case "5":
            return _addElement( diagram, target, parent ?? null, databaseorange_img, 'New database entry', 'Add <span>Data object</span> to <span>Database 1</span>');
        case "6":
            return _addElement( diagram, target, parent ?? null, databaseorange_img, 'Update database', 'Update <span>Database 1</span>');
        case "7":
            return _addElement( diagram, target, parent ?? null, actionorange_img, 'Perform an action', 'Perform <span>Action 1</span>');
        case "8":
            return _addElement( diagram, target, parent ?? null, twitterorange_img, 'Make a tweet', 'Tweet <span>Query 1</span> with the account <span>@alyssaxuu</span>');
        case "9":
            return _addElement( diagram, target, parent ?? null, logred_img, 'Add new log entry', 'Add new <span>success</span> log entry');
        case "10":
            return _addElement( diagram, target, parent ?? null, logred_img, 'Update logs', 'Edit <span>Log Entry 1</span>');
        case "11":
            return _addElement( diagram, target, parent ?? null, errorred_img, 'Prompt an error', 'Trigger <span>Error 1</span>');
        default:
            return condition.addElement( diagram, target, parent  )  
    }
}

const _addElement = ( diagram: FlowyDiagram, target:HTMLElement, parent:HTMLElement|null, image_url:URL, title:string, description:string ) =>  {
    
    if( parent && isBlockAlreadyLinked( diagram, parent.id )) {
        return false
    }

    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src='${image_url}'>
                    <p class='blockyname'>${title}</p>
            </div>
            <div class='blockyright'>
                <img src='${mode_img}'>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>${unsafeHTML(description)}</div>
        </div>
        `
    
    
    target.setAttribute('draggable', 'true')
    target.innerHTML = '' // delete children

    render( content, target )

    return true
}

const  _createTemplate = ( value:number, image_url:URL, title:string, description:string ) => 
    html`
    <div class="blockelem create-flowy noselect" blockelemtype="${value}" draggable="true">
        <div class="grabme">
            <img src="${grabme_img}">
        </div>
        <div class="blockin">
            <div class="blockico">
                <span></span>
                <img src="${image_url}">
            </div>
            <div class="blocktext">
                <p class="blocktitle">${title}</p>
                <p class="blockdesc">${unsafeHTML(description)}</p>
            </div>
        </div>
    </div>    
    `

const _addTemplates =  ( target:HTMLElement ) => {

    let templates = [
            _createTemplate( 1, eye_img, 'New visitor', 'Triggers when somebody visits a specified page'),
            _createTemplate( 2, action_img, 'Action is performed', 'Triggers when somebody performs a specified action'),
            _createTemplate( 3, time_img, 'Time has passed', 'Triggers after a specified amount of time'),
            _createTemplate( 4, error_img, 'Error prompt', 'Triggers when a specified error happens'),
    
            _createTemplate(5, database_img, 'New database entry', 'Adds a new entry to a specified database'),
            _createTemplate(6, database_img, 'Update database', 'Edits and deletes database entries and properties'),
            _createTemplate(7, action_img, 'Perform an action', 'Performs or edits a specified action'),
            _createTemplate(8, twitter_img, 'Make a tweet', 'Makes a tweet with a specified query'),

            _createTemplate(9, log_img, 'Add new log entry', 'Adds a new log entry to this project'),
            _createTemplate(10, log_img, 'Update logs', 'Edits and deletes log entries in this project'),
            _createTemplate(11, error_img, 'Prompt an error', 'Triggers a specified error'),  
    ]

    templates = templates.concat( condition.createConditionTemplates() )

    render(html`${templates}`, target)
        
} 

const _addPropertiesSheet = ( diagram:FlowyDiagram, target:HTMLElement, element:HTMLElement ) => {

    const closed = (e:UIEvent) => {

        const event = new CustomEvent<HTMLElement>('sheetClosed', {
            detail: element
        })
        diagram.dispatchEvent(event)

    }
    const content =  html`
    <div id="properties">
        <div id="close" @click="${closed}">
            <img src="${close_img}">
        </div>
        <p id="header2">Properties</p>
        <div id="propswitch">
            <div id="dataprop">Data</div>
            <div id="alertprop">Alerts</div>
            <div id="logsprop">Logs</div>
        </div>
        <div id="proplist">
            <p class="inputlabel">Select database</p>
            <div class="dropme">Database 1 <img src="${dropdown_img}"></div>
            <p class="inputlabel">Check properties</p>
            <div class="dropme">All<img src="${dropdown_img}"></div>
            <div class="checkus"><img src="${checkon_img}"><p>Log on successful performance</p></div>
            <div class="checkus"><img src="${checkoff_img}"><p>Give priority to this block</p></div>
        </div>
        <div id="divisionthing"></div>
        <div id="removeblock" @click="${() => diagram.deleteBlocks()}">Delete blocks</div>
    </div>
    `
    render( content, target )

}
