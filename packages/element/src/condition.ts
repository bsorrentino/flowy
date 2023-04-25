import {render, html } from 'lit-html';
import type { FlowyDiagram } from 'flowy-engine'
import { numBlockLinked, isBlockAlreadyLinked, blockType } from './element-utils'

const grabme_img = new URL('../assets/grabme.svg', import.meta.url)

const CONDITION_TYPE = 'condition'
const CONDITION_TEST_TYPE = `${CONDITION_TYPE}.test`

export const  createConditionTemplates = () => 
    [
        html`
        <div class="blockelem create-flowy noselect" blockelemtype="${CONDITION_TYPE}">
            <div class="grabme">
                <img src="${grabme_img}">
            </div>
            <div class="blockin">
                <div class="blockico">
                    <span></span>
                    <img src="">
                </div>
                <div class="blocktext">
                    <p class="blocktitle">Condition</p>
                    <p class="blockdesc">This is a condition element</p>
                </div>
            </div>
        </div>`,
        html`
        <div class="blockelem create-flowy noselect" blockelemtype="${CONDITION_TEST_TYPE}">
            <div class="grabme">
                <img src="${grabme_img}">
            </div>
            <div class="blockico">
                <span></span>
                <img src="">
            </div>
            <div class="blockin">
                <div class="blocktext">
                    <p class="blocktitle">Test</p>
                    <p class="blockdesc">This is a condition test element</p>
                </div>
            </div>
        </div>`
    ]

export const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    if( !parent ) return false // GUARD

    switch( blockType(target) ) {
        case CONDITION_TYPE:
            const result =  addConditionElement( diagram, target, parent )
            // diagram.debugAddLinkedBlock( conditionTestElement( '148px', '413.5px' ), target   )
            if(  result ) {
                diagram.debugAddLinkedBlock( conditionTestTemplate(), target )
                diagram.debugAddLinkedBlock( conditionTestTemplate(), target )
            }
            return result
        case CONDITION_TEST_TYPE:  
            return addConditionTestElement( diagram, target, parent )
        default:
            return false
    }
}

const conditionTestTemplate = () =>  {

    const target = document.createElement( 'div' )
    target.classList.add( 'blockelem' )
    target.classList.add( 'create-flowy' )
    target.classList.add( 'noselect' )
    target.setAttribute( 'blockelemtype', CONDITION_TEST_TYPE)

    const content = 
        html`
        <div class="grabme">
            <img src="${grabme_img}">
        </div>
        <div class="blockico">
            <span></span>
            <img src="">
        </div>
        <div class="blockin">
            <div class="blocktext">
                <p class="blocktitle">Test</p>
                <p class="blockdesc">This is a condition test element</p>
            </div>
        </div> `
    render( content, target )

    return target
}

const addConditionTestElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?: HTMLElement  ) =>  {
    if( !parent ) return false // GUARD
    if( blockType(parent) !== CONDITION_TYPE ) return false
    if( numBlockLinked( diagram, parent.id ) >= 2 ) return false // GUARD

    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                <p class='blockyname'>TEST</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition branch</div>
        </div>
        `
    target.innerHTML = '' // delete children
    render( content, target )

    return true
}


const addConditionElement = (diagram:FlowyDiagram, target:HTMLElement, parent?: HTMLElement ) =>  {
    if( !parent ) return false // GUARD
    if( isBlockAlreadyLinked( diagram, parent.id ) ) return false // GUARD
    if( blockType(parent) === CONDITION_TYPE ) return false // GUARD

    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                    <p class='blockyname'>CONDITION</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition element</div>
        </div>
        `

    target.innerHTML = '' // delete children
    render( content, target )

    return true
}
